import { useMemo, useState } from "react";
import { getMugImageUrl } from "../lib/storage";

function MugCarousel({ images = [], fallbackAlt = "Mug image" }) {
  const normalizedImages = useMemo(() => {
    return [...images]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .filter((img) => img?.storage_path);
  }, [images]);

  const [currentIndex, setCurrentIndex] = useState(0);

  if (!normalizedImages.length) {
    return <div className="photo-placeholder">Фото будет здесь</div>;
  }

  const currentImage = normalizedImages[currentIndex];

  function goPrev() {
    setCurrentIndex((prev) =>
      prev === 0 ? normalizedImages.length - 1 : prev - 1
    );
  }

  function goNext() {
    setCurrentIndex((prev) =>
      prev === normalizedImages.length - 1 ? 0 : prev + 1
    );
  }

  return (
    <div className="mug-carousel">
      <div className="mug-carousel-main">
        <img
          className="mug-carousel-image"
          src={getMugImageUrl(currentImage.storage_path)}
          alt={currentImage.alt_text || fallbackAlt}
        />

        {normalizedImages.length > 1 && (
          <>
            <button
              type="button"
              className="carousel-arrow carousel-arrow-left"
              onClick={goPrev}
            >
              ‹
            </button>

            <button
              type="button"
              className="carousel-arrow carousel-arrow-right"
              onClick={goNext}
            >
              ›
            </button>
          </>
        )}
      </div>

      {normalizedImages.length > 1 && (
        <div className="mug-carousel-thumbs">
          {normalizedImages.map((img, index) => (
            <button
              key={img.id}
              type="button"
              className={
                index === currentIndex
                  ? "mug-carousel-thumb active"
                  : "mug-carousel-thumb"
              }
              onClick={() => setCurrentIndex(index)}
            >
              <img
                src={getMugImageUrl(img.storage_path)}
                alt={img.alt_text || fallbackAlt}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default MugCarousel;