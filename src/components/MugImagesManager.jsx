import { useCallback, useEffect, useState } from "react";
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
import ImageCropperModal from "./ImageCropperModal";

function formatFileSize(bytes = 0) {
  if (!bytes) return "0 KB";
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

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
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onReplace(image, file);
              }
              event.target.value = "";
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

function PendingImageCard({ file, index, onRemove }) {
  return (
    <div
      style={{
        border: "1px solid #e1e9e2",
        borderRadius: "16px",
        padding: "12px",
        background: "#fbfcfb",
        display: "grid",
        gap: "8px",
      }}
    >
      <div style={{ fontWeight: 700, color: "#1f2937" }}>#{index + 1}</div>
      <div style={{ color: "#374151", wordBreak: "break-word" }}>{file.name}</div>
      <div style={{ color: "#6b7280", fontSize: "13px" }}>
        {formatFileSize(file.size)}
      </div>
      <button
        type="button"
        className="danger-button"
        onClick={onRemove}
      >
        Удалить
      </button>
    </div>
  );
}

function MugImagesManager({
  mugId,
  onChanged,
  pendingFiles = [],
  onPendingFilesChange,
  language = "ru",
}) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyImageId, setBusyImageId] = useState("");
  const [error, setError] = useState("");

  // Crop queue for "add" flow: process files one at a time, collect blobs
  const [cropQueue, setCropQueue] = useState([]); // Files waiting to be cropped
  // Crop context for "replace" flow
  const [cropReplaceCtx, setCropReplaceCtx] = useState(null); // { image, file }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  const loadImages = useCallback(async () => {
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
  }, [mugId]);

  useEffect(() => {
    if (!mugId) {
      setImages([]);
      return;
    }

    loadImages();
  }, [mugId, loadImages]);

  async function submitAddBlobs(blobs) {
    const files = blobs.map((blob, i) =>
      new File([blob], `photo-${i + 1}.png`, { type: "image/png" })
    );

    if (!mugId) {
      if (pendingFiles.length + files.length > 10) {
        setError("У одной кружки может быть максимум 10 изображений.");
        return;
      }
      setError("");
      onPendingFilesChange?.([...(pendingFiles || []), ...files]);
      return;
    }

    if (images.length + files.length > 10) {
      setError("У одной кружки может быть максимум 10 изображений.");
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
    }
  }

  // Accumulator for multi-file crop (lives in state to survive re-renders between crops)
  const [accumulatedBlobs, setAccumulatedBlobs] = useState([]);

  // Collect blob from each cropped file; submit all once the queue is empty.
  function handleAddCropSimple(blob) {
    const newBlobs = [...accumulatedBlobs, blob];
    const newQueue = cropQueue.slice(1);

    if (newQueue.length === 0) {
      setCropQueue([]);
      setAccumulatedBlobs([]);
      submitAddBlobs(newBlobs);
    } else {
      setAccumulatedBlobs(newBlobs);
      setCropQueue(newQueue);
    }
  }

  function handleCancelAddCrop() {
    setCropQueue([]);
    setAccumulatedBlobs([]);
  }

  async function handleReplaceCrop(blob) {
    if (!cropReplaceCtx) return;
    const { image } = cropReplaceCtx;
    setCropReplaceCtx(null);
    setBusyImageId(image.id);
    setError("");
    try {
      const file = new File([blob], "photo.png", { type: "image/png" });
      await replaceMugImage(image, file);
      await loadImages();
      await onChanged?.();
    } catch (err) {
      setError(err.message || "Не удалось заменить изображение.");
    } finally {
      setBusyImageId("");
    }
  }

  // "Add photo" — queue files through cropper instead of uploading directly
  function handleUpload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    const currentCount = mugId ? images.length : pendingFiles.length;
    if (currentCount + files.length > 10) {
      setError("У одной кружки может быть максимум 10 изображений.");
      return;
    }

    setError("");
    setAccumulatedBlobs([]);
    setCropQueue(files);
  }

  // "Replace" — route through cropper
  function handleReplaceStart(image, file) {
    setCropReplaceCtx({ image, file });
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

  const activeCount = mugId ? images.length : pendingFiles.length;

  return (
    <section className="mug-images-manager">
      <div className="mug-images-manager-head">
        <div>
          <div className="mug-images-manager-title">Фотографии кружки</div>
          <div className="mug-images-manager-subtitle">
            {activeCount} / 10 изображений
          </div>
        </div>

        <label
          className={`primary-button upload-images-label ${
            activeCount >= 10 ? "disabled-label" : ""
          }`}
        >
          {uploading ? "Загружаем..." : "Добавить фото"}
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            disabled={uploading || activeCount >= 10}
            onChange={handleUpload}
          />
        </label>
      </div>

      {!mugId && (
        <div className="empty-inline">
          Фотографии можно добавить уже сейчас. Они загрузятся автоматически,
          когда кружка будет сохранена.
        </div>
      )}

      {error && <div className="form-error">{error}</div>}

      {!mugId ? (
        pendingFiles.length === 0 ? (
          <div className="empty-inline">
            Пока нет фотографий. Выберите файлы до сохранения кружки.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "12px",
            }}
          >
            {pendingFiles.map((file, index) => (
              <PendingImageCard
                key={`${file.name}-${file.size}-${index}`}
                file={file}
                index={index}
                onRemove={() =>
                  onPendingFilesChange?.(
                    pendingFiles.filter((_, fileIndex) => fileIndex !== index)
                  )
                }
              />
            ))}
          </div>
        )
      ) : loading ? (
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
                  onReplace={handleReplaceStart}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Crop modal for "add" queue — shown for each file in sequence */}
      {cropQueue.length > 0 && (
        <ImageCropperModal
          key={cropQueue[0].name + cropQueue[0].size}
          file={cropQueue[0]}
          language={language}
          onCrop={handleAddCropSimple}
          onCancel={handleCancelAddCrop}
        />
      )}

      {/* Crop modal for "replace" flow */}
      {cropReplaceCtx && (
        <ImageCropperModal
          file={cropReplaceCtx.file}
          language={language}
          onCrop={handleReplaceCrop}
          onCancel={() => setCropReplaceCtx(null)}
        />
      )}
    </section>
  );
}

export default MugImagesManager;
