import { useState } from "react";

function PersonDetailModal({ person, mugs, countries, onClose, language = "ru" }) {
  const [selectedCountry, setSelectedCountry] = useState(null);
  const initials = `${person?.first_name?.[0] || ""}${person?.last_name?.[0] || ""}`.toUpperCase();

  const t = {
    ru: {
      close: "Закрыть",
      from: "из",
      mugsCount: "кружек",
      visitedCountries: "Страны, откуда привез кружки",
      mugsByPerson: "Кружки от этого человека",
      noMugs: "Нет кружек",
      biography: "О человеке",
      noBio: "Информация не добавлена",
    },
    en: {
      close: "Close",
      from: "from",
      mugsCount: "mugs",
      visitedCountries: "Countries visited",
      mugsByPerson: "Mugs from this person",
      noMugs: "No mugs",
      biography: "Biography",
      noBio: "No information",
    },
  };

  const tr = t[language] || t.ru;

  if (!person) return null;

  // Группируем кружки по странам
  const mugsByCountry = {};
  mugs.forEach((mug) => {
    const personIds = Array.isArray(mug.brought_by_person_ids)
      ? mug.brought_by_person_ids
      : mug.brought_by_person_id
      ? [mug.brought_by_person_id]
      : [];

    if (!personIds.includes(person.id)) {
      return;
    }

    const countryName =
      language === "en"
        ? countries.find((c) => c.id === mug.country_id)?.name_en || "Unknown"
        : countries.find((c) => c.id === mug.country_id)?.name_ru || "Unknown";

    if (!mugsByCountry[countryName]) {
      mugsByCountry[countryName] = [];
    }
    mugsByCountry[countryName].push(mug);
  });

  const countries_visited = Object.keys(mugsByCountry);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "20px",
          maxWidth: "600px",
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          padding: "30px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
          {person.avatar_image_path ? (
            <img
              src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/mug-images/${person.avatar_image_path}`}
              alt={`${person.first_name} ${person.last_name}`}
              style={{
                width: "120px",
                height: "120px",
                borderRadius: "12px",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              aria-label={`${person.first_name} ${person.last_name}`}
              style={{
                width: "120px",
                height: "120px",
                borderRadius: "12px",
                background: "#e8e1d7",
                color: "#5b4b3f",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "34px",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {initials || "?"}
            </div>
          )}

          <div>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "24px" }}>
              {person.first_name} {person.last_name}
            </h2>
            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                marginTop: "8px",
              }}
            >
              {countries_visited.map((country) => (
                <span
                  key={country}
                  onClick={() =>
                    setSelectedCountry(
                      selectedCountry === country ? null : country
                    )
                  }
                  style={{
                    padding: "4px 12px",
                    background:
                      selectedCountry === country ? "#2F7D57" : "#E8E1D7",
                    color:
                      selectedCountry === country ? "#ffffff" : "#1f2937",
                    borderRadius: "999px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {country} ({mugsByCountry[country].length})
                </span>
              ))}
            </div>
          </div>
        </div>

        {person.bio && (
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666" }}>
              {tr.biography}
            </h3>
            <p style={{ margin: 0, lineHeight: "1.6", color: "#333" }}>
              {person.bio}
            </p>
          </div>
        )}

        {person.instagram_url && (
          <div style={{ marginBottom: "20px" }}>
            <a
              href={person.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                background: "#E4405F",
                color: "#ffffff",
                textDecoration: "none",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "14px",
              }}
            >
              📷 Instagram профиль
            </a>
          </div>
        )}

        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>
            {tr.mugsByPerson}
          </h3>

          {countries_visited.length === 0 ? (
            <p style={{ color: "#999" }}>{tr.noMugs}</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "12px" }}>
              {(selectedCountry ? mugsByCountry[selectedCountry] : mugs.filter((m) => {
                const personIds = Array.isArray(m.brought_by_person_ids)
                  ? m.brought_by_person_ids
                  : m.brought_by_person_id
                  ? [m.brought_by_person_id]
                  : [];
                return personIds.includes(person.id);
              })).map(
                (mug) => (
                  <div
                    key={mug.id}
                    style={{
                      background: "#f5efe6",
                      borderRadius: "8px",
                      padding: "8px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        background: "#ddd",
                        height: "80px",
                        borderRadius: "6px",
                        marginBottom: "4px",
                      }}
                    />
                    <p
                      style={{
                        margin: 0,
                        fontSize: "12px",
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {mug.title}
                    </p>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "12px",
            background: "#1f6f54",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {tr.close}
        </button>
      </div>
    </div>
  );
}

export default PersonDetailModal;
