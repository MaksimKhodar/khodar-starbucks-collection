import { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  listMugImages,
  uploadImagesForMug,
  deleteMugImage,
  replaceMugImage,
  reorderMugImages,
  mugImagePublicUrl,
} from "../lib/mugImages";

function SortableImageCard({ image, busy, onDelete, onReplace }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`mug-image-admin-card ${isDragging ? "dragging" : ""}`}
    >
      <img
        className="mug-image-admin-preview"
        src={mugImagePublicUrl(image.storage_path)}
        alt={image.alt_text || "Mug image"}
      />

      <div className="mug-image-admin-meta">
        <span className="mug-image-admin-order">#{image.sort_order + 1}</span>
        <span className="mug-image-admin-path">{image.storage_path}</span>
      </div>

      <div className="mug-image-admin-actions">
        <button
          type="button"
          className="drag-handle-button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          disabled={busy}
          title="Перетащить"
        >
          ↕ Перетащить
        </button>

        <label className="secondary-button replace-image-label">
          Заменить
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onReplace(image, file);
              }
              e.target.value = "";
            }}
          />
        </label>

        <button
          type="button"
          className="danger-button"
          disabled={busy}
          onClick={() => onDelete(image)}
        >
          Удалить
        </button>
      </div>
    </div>
  );
}

function MugImagesManager({ mugId, onChanged }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyImageId, setBusyImageId] = useState("");
  const [error, setError] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  useEffect(() => {
    if (!mugId) {
      setImages([]);
      return;
    }

    loadImages();
  }, [mugId]);

  async function loadImages() {
    if (!mugId) return;

    setLoading(true);
    setError("");

    try {
      const data = await listMugImages(mugId);
      setImages(data);
    } catch (err) {
      setError(err.message || "Не удалось загрузить изображения.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (images.length + files.length > 10) {
      setError("У одной кружки может быть максимум 10 изображений.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    setError("");

    try {
      await uploadImagesForMug(mugId, files, images.length);
      await loadImages();
      await onChanged?.();
    } catch (err) {
      setError(err.message || "Не удалось загрузить изображения.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(image) {
    const confirmed = window.confirm("Удалить это изображение?");
    if (!confirmed) return;

    setBusyImageId(image.id);
    setError("");

    try {
      await deleteMugImage(image);
      await loadImages();
      await onChanged?.();
    } catch (err) {
      setError(err.message || "Не удалось удалить изображение.");
    } finally {
      setBusyImageId("");
    }
  }

  async function handleReplace(image, file) {
    setBusyImageId(image.id);
    setError("");

    try {
      await replaceMugImage(image, file);
      await loadImages();
      await onChanged?.();
    } catch (err) {
      setError(err.message || "Не удалось заменить изображение.");
    } finally {
      setBusyImageId("");
    }
  }

  async function handleDragEnd(event) {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = images.findIndex((img) => img.id === active.id);
    const newIndex = images.findIndex((img) => img.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(images, oldIndex, newIndex).map(
      (image, index) => ({
        ...image,
        sort_order: index,
      })
    );

    setImages(reordered);
    setError("");

    try {
      await reorderMugImages(
        mugId,
        reordered.map((img) => img.id)
      );
      await loadImages();
      await onChanged?.();
    } catch (err) {
      setError(err.message || "Не удалось сохранить порядок изображений.");
      await loadImages();
    }
  }

  if (!mugId) {
    return (
      <div className="image-manager-placeholder">
        Сначала сохраните кружку. После этого здесь появится управление галереей
        до 10 изображений.
      </div>
    );
  }

  return (
    <section className="mug-images-manager">
      <div className="mug-images-manager-head">
        <div>
          <div className="mug-images-manager-title">Фотографии кружки</div>
          <div className="mug-images-manager-subtitle">
            {images.length} / 10 изображений
          </div>
        </div>

        <label
          className={`primary-button upload-images-label ${
            images.length >= 10 ? "disabled-label" : ""
          }`}
        >
          {uploading ? "Загружаем..." : "Добавить фото"}
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            disabled={uploading || images.length >= 10}
            onChange={handleUpload}
          />
        </label>
      </div>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <div className="empty-inline">Загрузка изображений...</div>
      ) : images.length === 0 ? (
        <div className="empty-inline">
          Пока нет фотографий. Загрузите первую.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={images.map((img) => img.id)}
            strategy={rectSortingStrategy}
          >
            <div className="mug-images-grid">
              {images.map((image) => (
                <SortableImageCard
                  key={image.id}
                  image={image}
                  busy={uploading || busyImageId === image.id}
                  onDelete={handleDelete}
                  onReplace={handleReplace}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

export default MugImagesManager;