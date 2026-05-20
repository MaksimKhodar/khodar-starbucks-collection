import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getMugImageUrl } from "../lib/storage";

// ── Lightbox — рендерится через портал в document.body ────────────────────────

function Lightbox({ images, startIndex, onClose }) {
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex(i => i === 0 ? images.length - 1 : i - 1);
      if (e.key === "ArrowRight") setIndex(i => i === images.length - 1 ? 0 : i + 1);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [images, onClose]);

  const img = images[index];

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(0,0,0,0.92)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "zoom-out",
      }}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        style={{
          position: "absolute", top: 16, right: 20,
          background: "none", border: "none",
          color: "#fff", fontSize: 36, cursor: "pointer",
          lineHeight: 1, opacity: 0.8, zIndex: 2, padding: "4px 8px",
        }}
      >×</button>

      {/* Counter */}
      {images.length > 1 && (
        <div style={{
          position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)",
          color: "rgba(255,255,255,0.6)", fontSize: 13, zIndex: 2,
          background: "rgba(0,0,0,0.4)", padding: "3px 10px", borderRadius: 999,
        }}>
          {index + 1} / {images.length}
        </div>
      )}

      {/* Main image */}
      <img
        src={getMugImageUrl(img.storage_path, { width: 800, quality: 80 })}
        alt={img.alt_text || ""}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: "88vw",
          maxHeight: "82vh",
          objectFit: "contain",
          borderRadius: 4,
          cursor: "default",
          userSelect: "none",
          display: "block",
        }}
      />

      {/* Prev */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setIndex(i => i === 0 ? images.length - 1 : i - 1); }}
            style={{
              position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.15)", border: "none",
              color: "#fff", fontSize: 28, width: 48, height: 48, borderRadius: "50%",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 2,
            }}
          >‹</button>

          {/* Next */}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setIndex(i => i === images.length - 1 ? 0 : i + 1); }}
            style={{
              position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.15)", border: "none",
              color: "#fff", fontSize: 28, width: 48, height: 48, borderRadius: "50%",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 2,
            }}
          >›</button>
        </>
      )}

      {/* Thumbnails */}
      {images.length > 1 && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
            display: "flex", gap: 6, zIndex: 2,
            maxWidth: "90vw", overflowX: "auto", padding: "4px 8px",
          }}
        >
          {images.map((thumb, i) => (
            <button
              key={thumb.id || i}
              type="button"
              onClick={() => setIndex(i)}
              style={{
                width: 52, height: 52, flexShrink: 0, padding: 0, border: "none",
                borderRadius: 6, overflow: "hidden", cursor: "pointer",
                outline: i === index ? "2px solid #fff" : "2px solid transparent",
                outlineOffset: 2, opacity: i === index ? 1 : 0.45,
                transition: "opacity 0.15s",
              }}
            >
              <img
                loading="lazy"
                src={getMugImageUrl(thumb.storage_path, { width: 120, quality: 70 })}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

// ── MugCarousel ───────────────────────────────────────────────────────────────

function MugCarousel({ images = [], fallbackAlt = "Mug image" }) {
  const normalizedImages = useMemo(() => {
    return [...images]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .filter((img) => img?.storage_path);
  }, [images]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!normalizedImages.length) {
    return (
      <div
        className="photo-placeholder"
        style={{
          width: "100%", height: "100%",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        Фото будет здесь
      </div>
    );
  }

  const currentImage = normalizedImages[currentIndex];

  function goPrev(e) {
    e.stopPropagation();
    setIsLoading(true);
    setCurrentIndex(prev => prev === 0 ? normalizedImages.length - 1 : prev - 1);
  }

  function goNext(e) {
    e.stopPropagation();
    setIsLoading(true);
    setCurrentIndex(prev => prev === normalizedImages.length - 1 ? 0 : prev + 1);
  }

  return (
    <>
      <div className="mug-carousel" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {/* Main image area */}
        <div
          className="mug-carousel-main"
          onClick={() => setLightboxOpen(true)}
          style={{
            flex: 1,
            cursor: "zoom-in",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {isLoading && <div className="mug-carousel-shimmer" />}
          <img
            key={currentImage.storage_path}
            className="mug-carousel-image"
            loading="lazy"
            src={getMugImageUrl(currentImage.storage_path)}
            alt={currentImage.alt_text || fallbackAlt}
            onLoad={() => setIsLoading(false)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              display: "block",
              pointerEvents: "none",
              userSelect: "none",
              opacity: isLoading ? 0 : 1,
              transition: "opacity 0.25s",
            }}
          />

          {normalizedImages.length > 1 && (
            <>
              <button
                type="button"
                className="carousel-arrow carousel-arrow-left"
                onClick={goPrev}
              >‹</button>
              <button
                type="button"
                className="carousel-arrow carousel-arrow-right"
                onClick={goNext}
              >›</button>
            </>
          )}
        </div>

        {/* Dots indicator */}
        {normalizedImages.length > 1 && (
          <div style={{
            position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)",
            display: "flex", gap: 5, zIndex: 2,
          }}>
            {normalizedImages.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={e => { e.stopPropagation(); setCurrentIndex(i); }}
                style={{
                  width: i === currentIndex ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  border: "none",
                  background: i === currentIndex ? "#fff" : "rgba(255,255,255,0.5)",
                  padding: 0,
                  cursor: "pointer",
                  transition: "width 0.2s, background 0.2s",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {lightboxOpen && (
        <Lightbox
          images={normalizedImages}
          startIndex={currentIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}

export default MugCarousel;
