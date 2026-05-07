import { useState, useCallback, useEffect } from "react";
import Cropper from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";

const LABELS = {
  ru: {
    cropTitle: "Обрезать фото",
    cropZoom: "Масштаб",
    cropRotate: "Поворот",
    cropReset: "Сбросить",
    cropCancel: "Отмена",
    cropConfirm: "Обрезать",
  },
  en: {
    cropTitle: "Crop photo",
    cropZoom: "Zoom",
    cropRotate: "Rotate",
    cropReset: "Reset",
    cropCancel: "Cancel",
    cropConfirm: "Crop",
  },
};

function createImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.setAttribute("crossOrigin", "anonymous");
    img.src = url;
  });
}

// Canvas-based crop with rotation support.
// Takes imageSrc (object URL), pixelCrop {x,y,width,height}, rotation (degrees).
// Returns Promise<Blob> (image/png), max 1400×1400px.
async function getCroppedImg(imageSrc, pixelCrop, rotation = 0) {
  const image = await createImage(imageSrc);

  // Compute bounding box of the rotated image
  const rad = (rotation * Math.PI) / 180;
  const bboxW = Math.round(
    Math.abs(image.width * Math.cos(rad)) + Math.abs(image.height * Math.sin(rad))
  );
  const bboxH = Math.round(
    Math.abs(image.width * Math.sin(rad)) + Math.abs(image.height * Math.cos(rad))
  );

  // Draw rotated image onto an intermediate canvas
  const rotCanvas = document.createElement("canvas");
  rotCanvas.width = bboxW;
  rotCanvas.height = bboxH;
  const rotCtx = rotCanvas.getContext("2d");
  rotCtx.translate(bboxW / 2, bboxH / 2);
  rotCtx.rotate(rad);
  rotCtx.translate(-image.width / 2, -image.height / 2);
  rotCtx.drawImage(image, 0, 0);

  // Crop and optionally scale down to max 1400px
  const MAX_OUT = 1400;
  const scale = Math.min(1, MAX_OUT / pixelCrop.width, MAX_OUT / pixelCrop.height);
  const outW = Math.round(pixelCrop.width * scale);
  const outH = Math.round(pixelCrop.height * scale);

  const outCanvas = document.createElement("canvas");
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext("2d");
  outCtx.drawImage(
    rotCanvas,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, outW, outH
  );

  return new Promise((resolve) => outCanvas.toBlob(resolve, "image/png"));
}

export default function ImageCropperModal({ file, onCrop, onCancel, language = "ru" }) {
  const ui = LABELS[language] || LABELS.ru;
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = orig; };
  }, []);

  useEffect(() => {
    function handleKey(e) { if (e.key === "Escape") onCancel?.(); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleConfirm() {
    if (!croppedAreaPixels || !imageSrc) return;
    setIsCropping(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
      onCrop(blob);
    } finally {
      setIsCropping(false);
    }
  }

  function handleReset() {
    setZoom(1);
    setRotation(0);
    setCrop({ x: 0, y: 0 });
  }

  if (!file) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(0,0,0,0.85)",
        display: "flex", flexDirection: "column",
        alignItems: isMobile ? "stretch" : "center",
        justifyContent: isMobile ? "stretch" : "center",
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel?.(); }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: isMobile ? 0 : 20,
          width: isMobile ? "100%" : "min(560px, calc(100vw - 32px))",
          maxHeight: isMobile ? "100dvh" : "90vh",
          height: isMobile ? "100dvh" : undefined,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          boxShadow: isMobile ? "none" : "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "0.5px solid #e8e2d9", flexShrink: 0,
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#153126" }}>{ui.cropTitle}</span>
          <button
            type="button" onClick={onCancel}
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af", lineHeight: 1, padding: 4 }}
          >✕</button>
        </div>

        {/* Crop area — react-easy-crop requires explicit height on container */}
        <div style={{ flex: 1, position: "relative", background: "#1a1a1a", minHeight: 260 }}>
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        {/* Controls */}
        <div style={{
          padding: "16px 20px", borderTop: "0.5px solid #e8e2d9",
          display: "flex", flexDirection: "column", gap: 12,
          flexShrink: 0, background: "#fff",
        }}>
          {/* Zoom slider */}
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "#31443a" }}>
              <span>{ui.cropZoom}</span>
              <span style={{ color: "#8a9e96", fontWeight: 400 }}>{zoom.toFixed(2)}×</span>
            </div>
            <input
              type="range" min={1} max={3} step={0.01}
              value={zoom} onChange={e => setZoom(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#1f6f54" }}
            />
          </label>

          {/* Rotate slider */}
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "#31443a" }}>
              <span>{ui.cropRotate}</span>
              <span style={{ color: "#8a9e96", fontWeight: 400 }}>
                {rotation >= 0 ? "+" : ""}{rotation.toFixed(1)}°
              </span>
            </div>
            <input
              type="range" min={-45} max={45} step={0.1}
              value={rotation} onChange={e => setRotation(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#1f6f54" }}
            />
          </label>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              type="button" onClick={handleReset}
              style={{
                padding: "9px 14px", border: "0.5px solid #e2ddd4", borderRadius: 10,
                background: "transparent", fontSize: 13, color: "#374151", cursor: "pointer", fontWeight: 500,
              }}
            >{ui.cropReset}</button>
            <div style={{ flex: 1 }} />
            <button
              type="button" onClick={onCancel}
              style={{
                padding: "9px 14px", border: "0.5px solid #e2ddd4", borderRadius: 10,
                background: "transparent", fontSize: 13, color: "#374151", cursor: "pointer", fontWeight: 500,
              }}
            >{ui.cropCancel}</button>
            <button
              type="button" onClick={handleConfirm}
              disabled={isCropping || !imageSrc}
              style={{
                padding: "9px 20px", border: "none", borderRadius: 10,
                background: "#1f6f54", color: "#fff", fontSize: 13, fontWeight: 600,
                cursor: "pointer", opacity: isCropping ? 0.7 : 1,
              }}
            >{isCropping ? "…" : ui.cropConfirm}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
