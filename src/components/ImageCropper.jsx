import { useEffect, useRef, useState } from "react";

const PREVIEW_SIZE = 320;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

function ImageCropper({ file, onCancel, onCrop, aspect = 1 }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    setImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!imageSrc) return;

    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      setNaturalSize({ width, height });
      const minZoom = Math.max(PREVIEW_SIZE / width, PREVIEW_SIZE / height);
      setZoom(minZoom);
      setPanX(0);
      setPanY(0);
      setLoading(false);
    };
  }, [imageSrc]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const scaledWidth = naturalSize.width * zoom;
  const scaledHeight = naturalSize.height * zoom;

  const maxPanX = Math.max(0, scaledWidth - PREVIEW_SIZE);
  const maxPanY = Math.max(0, scaledHeight - PREVIEW_SIZE);

  const clampPan = (value, max) => Math.max(-max, Math.min(0, value));
  const clampedPanX = clampPan(panX, maxPanX);
  const clampedPanY = clampPan(panY, maxPanY);

  const imageStyle = {
    position: "absolute",
    width: `${scaledWidth}px`,
    height: `${scaledHeight}px`,
    left: `${clampedPanX}px`,
    top: `${clampedPanY}px`,
    userSelect: "none",
    cursor: isDragging ? "grabbing" : "grab",
    touchAction: "none",
  };

  const startDrag = (clientX, clientY) => {
    setIsDragging(true);
    setDragStart({ x: clientX - clampedPanX, y: clientY - clampedPanY });
  };

  const updateDrag = (clientX, clientY) => {
    if (!isDragging) return;
    setPanX(clientX - dragStart.x);
    setPanY(clientY - dragStart.y);
  };

  function handleMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  }

  function handleMouseMove(e) {
    if (!isDragging) return;
    updateDrag(e.clientX, e.clientY);
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  function handleTouchStart(e) {
    if (!e.touches?.length) return;
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY);
  }

  function handleTouchMove(e) {
    if (!isDragging || !e.touches?.length) return;
    e.preventDefault();
    const touch = e.touches[0];
    updateDrag(touch.clientX, touch.clientY);
  }

  function handleTouchEnd() {
    setIsDragging(false);
  }

  function handleWheel(e) {
    e.preventDefault();
    e.stopPropagation();

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const oldZoom = zoom;
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));

    const zoomRatio = newZoom / oldZoom;
    setZoom(newZoom);
    setPanX(mouseX - (mouseX - clampedPanX) * zoomRatio);
    setPanY(mouseY - (mouseY - clampedPanY) * zoomRatio);
  }

  const handleZoomChange = (value) => {
    const centerX = PREVIEW_SIZE / 2;
    const centerY = PREVIEW_SIZE / 2;
    const oldZoom = zoom;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
    const zoomRatio = newZoom / oldZoom;

    setZoom(newZoom);
    setPanX(centerX - (centerX - clampedPanX) * zoomRatio);
    setPanY(centerY - (centerY - clampedPanY) * zoomRatio);
  };

  async function handleCrop() {
    if (!imageSrc) return;
    const image = new Image();
    image.src = imageSrc;

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });

    const canvas = document.createElement("canvas");
    canvas.width = PREVIEW_SIZE;
    canvas.height = PREVIEW_SIZE;
    const ctx = canvas.getContext("2d");

    const sourceX = -clampedPanX / zoom;
    const sourceY = -clampedPanY / zoom;
    const sourceSize = PREVIEW_SIZE / zoom;

    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      PREVIEW_SIZE,
      PREVIEW_SIZE
    );

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });

    if (!blob) return;
    const croppedFile = new File([blob], file.name, { type: "image/jpeg" });
    onCrop(croppedFile);
  }

  if (!file) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "22px",
        overflow: "hidden",
      }}
      onClick={onCancel}
      onWheel={(e) => e.preventDefault()}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "680px",
          background: "#ffffff",
          borderRadius: "24px",
          padding: "24px",
          boxSizing: "border-box",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", marginBottom: "18px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "20px" }}>Обрезать фото</h2>
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#666" }}>
              Перетащите фото, чтобы выбрать область. Колёсико мыши или ползунок меняют масштаб.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{
              border: "none",
              background: "transparent",
              color: "#666",
              fontSize: "16px",
              cursor: "pointer",
              padding: "8px",
            }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center" }}>Загрузка...</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", alignItems: "center", marginBottom: "18px" }}>
              <div
                ref={containerRef}
                style={{
                  position: "relative",
                  width: `${PREVIEW_SIZE}px`,
                  height: `${PREVIEW_SIZE}px`,
                  overflow: "hidden",
                  borderRadius: "18px",
                  background: "#f5f5f5",
                  border: "1px solid #e5e5e5",
                  touchAction: "none",
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onWheel={handleWheel}
              >
                <img src={imageSrc} alt="Crop preview" style={imageStyle} />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    border: "2px solid rgba(255,255,255,0.95)",
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.24)",
                    pointerEvents: "none",
                    borderRadius: "18px",
                  }}
                />
              </div>

              <div style={{ minWidth: "180px", flex: "1 1 180px" }}>
                <div style={{ marginBottom: "12px", fontSize: "14px", color: "#444" }}>
                  Масштаб
                </div>
                <input
                  type="range"
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => handleZoomChange(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "13px", color: "#888" }}>
                  <span>{Math.round(MIN_ZOOM * 100)}%</span>
                  <span>{Math.round(zoom * 100)}%</span>
                  <span>{Math.round(MAX_ZOOM * 100)}%</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleZoomChange(1)}
                  style={{
                    marginTop: "16px",
                    padding: "10px 14px",
                    width: "100%",
                    background: "#f3f3f3",
                    border: "1px solid #d7d7d7",
                    borderRadius: "10px",
                    cursor: "pointer",
                    fontSize: "14px",
                    color: "#444",
                  }}
                >
                  Сбросить масштаб
                </button>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "6px", fontSize: "13px", color: "#666" }}>
              <div>Перетаскивайте фото в рамке</div>
              <div>Размер кадра {PREVIEW_SIZE}×{PREVIEW_SIZE}</div>
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "12px" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "12px 18px",
              background: "#f2f2f2",
              border: "1px solid #d5ddd7",
              borderRadius: "10px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleCrop}
            disabled={loading}
            style={{
              padding: "12px 18px",
              background: "#2F7D57",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            Применить
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImageCropper;
