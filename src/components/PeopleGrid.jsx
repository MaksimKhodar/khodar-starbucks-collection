import { useMemo, useState } from "react";
import PersonDetailModal from "./PersonDetailModal";
import PersonEditModal from "./PersonEditModal";

function PeopleGrid({ people = [], mugs = [], countries = [], language = "ru", onPersonUpdated }) {
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [editingPerson, setEditingPerson] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const t = {
    ru: {
      searchPlaceholder: "Поиск по имени...",
      from: "из",
      mugsCount: "кружек",
      noPeopleFound: "Люди не найдены",
      totalPeople: "всего людей",
    },
    en: {
      searchPlaceholder: "Search by name...",
      from: "from",
      mugsCount: "mugs",
      noPeopleFound: "No people found",
      totalPeople: "total people",
    },
  };

  const tr = t[language] || t.ru;

  // Фильтруем людей по поисковому запросу
  const filteredPeople = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return people.filter(
      (person) =>
        person.first_name.toLowerCase().includes(query) ||
        person.last_name.toLowerCase().includes(query)
    );
  }, [people, searchQuery]);

  // Считаем кружки для каждого человека
  const personMugCount = useMemo(() => {
    const counts = {};
    people.forEach((person) => {
      counts[person.id] =
        mugs.filter((mug) => {
          const personIds = Array.isArray(mug.brought_by_person_ids)
            ? mug.brought_by_person_ids
            : mug.brought_by_person_id
            ? [mug.brought_by_person_id]
            : [];
          return personIds.includes(person.id);
        }).length || 0;
    });
    return counts;
  }, [people, mugs]);

  return (
    <section className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h2 className="section-title">Люди в коллекции</h2>
          <p style={{ margin: "4px 0 0 0", color: "#666", fontSize: "14px" }}>
            {filteredPeople.length} {tr.totalPeople}
          </p>
        </div>

        <input
          type="text"
          placeholder={tr.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: "8px 14px",
            borderRadius: "8px",
            border: "1px solid #e2e8e3",
            fontSize: "14px",
            fontFamily: "inherit",
          }}
        />
      </div>

      {filteredPeople.length === 0 ? (
        <div
          style={{
            padding: "40px 20px",
            textAlign: "center",
            color: "#999",
          }}
        >
          <p>{tr.noPeopleFound}</p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "16px",
          }}
        >
          {filteredPeople.map((person) => (
            <div
              key={person.id}
              onClick={() => setSelectedPerson(person)}
              style={{
                background: "#f9f7f3",
                borderRadius: "12px",
                overflow: "hidden",
                cursor: "pointer",
                transition: "all 0.3s ease",
                border: "2px solid transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow =
                  "0 12px 20px rgba(0, 0, 0, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Фото профиля */}
              <div
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  background: "#e8e1d7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  color: "#999",
                }}
              >
                {person.avatar_image_path ? (
                  <img
                    src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/mug-images/${person.avatar_image_path}`}
                    alt={`${person.first_name} ${person.last_name}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  "Нет фото"
                )}
              </div>

              {/* Информация */}
              <div style={{ padding: "12px" }}>
                <h3
                  style={{
                    margin: "0 0 6px 0",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#1f2937",
                  }}
                >
                  {person.first_name} {person.last_name}
                </h3>

                {person.instagram_url && (
                  <a
                    href={person.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "12px",
                      color: "#E4405F",
                      textDecoration: "none",
                      marginBottom: "8px",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    📷 Instagram
                  </a>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: "8px",
                    borderTop: "1px solid #e2e8e3",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#2F7D57",
                    }}
                  >
                    {personMugCount[person.id]} {tr.mugsCount}
                  </span>

                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPerson(person);
                      }}
                      style={{
                        padding: "4px 8px",
                        background: "#e8e1d7",
                        border: "1px solid #d5ddd7",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#1f2937",
                      }}
                    >
                      ✏️
                    </button>

                    <span
                      style={{
                        fontSize: "20px",
                        color: "#d4a574",
                      }}
                    >
                      →
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedPerson && (
        <PersonDetailModal
          person={selectedPerson}
          mugs={mugs}
          countries={countries}
          language={language}
          onClose={() => setSelectedPerson(null)}
        />
      )}

      {editingPerson && (
        <PersonEditModal
          person={editingPerson}
          language={language}
          onClose={() => setEditingPerson(null)}
          onUpdated={() => {
            setEditingPerson(null);
            onPersonUpdated?.();
          }}
        />
      )}
    </section>
  );
}

export default PeopleGrid;
