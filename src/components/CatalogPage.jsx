import { useEffect, useMemo, useState } from "react";
import MugCarousel from "./MugCarousel";

function normalizeIso2(value) {
  return (value || "").toUpperCase().trim();
}

function formatDate(value) {
  if (!value) return "—";
  return value.slice(0, 7);
}

export default function CatalogPage({
  mugs = [],
  countries = [],
  selectedCountryIso = "",
  selectedCountryLabel = "",
}) {
  const [search, setSearch] = useState("");
  const [countryIsoFilter, setCountryIsoFilter] = useState("");
  const [mugTypeFilter, setMugTypeFilter] = useState("");
  const [hasNoteOnly, setHasNoteOnly] = useState(false);
  const [sortBy, setSortBy] = useState("received-desc");

  useEffect(() => {
    if (selectedCountryIso) {
      setCountryIsoFilter(normalizeIso2(selectedCountryIso));
    }
  }, [selectedCountryIso]);

  const countriesById = useMemo(() => {
    const map = new Map();

    countries.forEach((country) => {
      map.set(country.id, country);
    });

    return map;
  }, [countries]);

  const countryOptions = useMemo(() => {
    return countries
      .map((country) => ({
        id: country.id,
        iso: normalizeIso2(country.iso2_code),
        label: country.name_ru || country.name_en || country.iso2_code || "—",
      }))
      .filter((country) => country.iso)
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [countries]);

  const mugTypeOptions = useMemo(() => {
    const uniqueTypes = new Set();

    mugs.forEach((mug) => {
      if (mug.mug_type) {
        uniqueTypes.add(mug.mug_type);
      }
    });

    return [...uniqueTypes].sort((a, b) => a.localeCompare(b, "ru"));
  }, [mugs]);

  const preparedMugs = useMemo(() => {
    return mugs.map((mug) => {
      const country = countriesById.get(mug.country_id);

      return {
        ...mug,
        countryIso: normalizeIso2(country?.iso2_code),
        countryName:
          country?.name_ru || country?.name_en || country?.iso2_code || "—",
      };
    });
  }, [mugs, countriesById]);

  const filteredMugs = useMemo(() => {
    let result = [...preparedMugs];

    if (search.trim()) {
      const q = search.trim().toLowerCase();

      result = result.filter((mug) => {
        const haystack = [
          mug.title,
          mug.city,
          mug.mug_type,
          mug.brought_by,
          mug.note,
          mug.countryName,
          mug.countryIso,
          mug.slug,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      });
    }

    if (countryIsoFilter) {
      result = result.filter((mug) => mug.countryIso === countryIsoFilter);
    }

    if (mugTypeFilter) {
      result = result.filter((mug) => mug.mug_type === mugTypeFilter);
    }

    if (hasNoteOnly) {
      result = result.filter((mug) => !!mug.note?.trim());
    }

    switch (sortBy) {
      case "title-asc":
        result.sort((a, b) => (a.title || "").localeCompare(b.title || "", "ru"));
        break;

      case "title-desc":
        result.sort((a, b) => (b.title || "").localeCompare(a.title || "", "ru"));
        break;

      case "country-asc":
        result.sort((a, b) =>
          (a.countryName || "").localeCompare(b.countryName || "", "ru")
        );
        break;

      case "received-asc":
        result.sort((a, b) =>
          (a.received_at || "").localeCompare(b.received_at || "")
        );
        break;

      case "received-desc":
      default:
        result.sort((a, b) =>
          (b.received_at || "").localeCompare(a.received_at || "")
        );
        break;
    }

    return result;
  }, [preparedMugs, search, countryIsoFilter, mugTypeFilter, hasNoteOnly, sortBy]);

  const activeCountryFromFilter = useMemo(() => {
    if (!countryIsoFilter) return null;
    return countryOptions.find((country) => country.iso === countryIsoFilter) || null;
  }, [countryIsoFilter, countryOptions]);

  function resetFilters() {
    setSearch("");
    setCountryIsoFilter(selectedCountryIso ? normalizeIso2(selectedCountryIso) : "");
    setMugTypeFilter("");
    setHasNoteOnly(false);
    setSortBy("received-desc");
  }

  function clearCountryFilter() {
    setCountryIsoFilter("");
  }

  return (
    <main style={styles.page}>
      <div style={styles.headerBlock}>
        <div>
          <h2 style={styles.title}>Каталог кружек</h2>
          <p style={styles.subtitle}>
            Формат маркетплейса: фильтры слева, карточки кружек справа.
          </p>
        </div>

        <div style={styles.topStats}>
          <div style={styles.topStat}>
            <span style={styles.topStatValue}>{mugs.length}</span>
            <span style={styles.topStatLabel}>всего кружек</span>
          </div>

          <div style={styles.topStat}>
            <span style={styles.topStatValue}>{filteredMugs.length}</span>
            <span style={styles.topStatLabel}>после фильтрации</span>
          </div>
        </div>
      </div>

      {(selectedCountryIso || selectedCountryLabel) && (
        <div style={styles.selectedCountryBanner}>
          <div>
            <strong>Фильтр от карты:</strong>{" "}
            {selectedCountryLabel || selectedCountryIso}
          </div>

          <div style={styles.bannerActions}>
            <button
              type="button"
              onClick={() =>
                setCountryIsoFilter(normalizeIso2(selectedCountryIso || ""))
              }
              style={styles.bannerButton}
            >
              Применить страну
            </button>

            <button
              type="button"
              onClick={clearCountryFilter}
              style={styles.bannerButtonSecondary}
            >
              Убрать фильтр страны
            </button>
          </div>
        </div>
      )}

      <div style={styles.layout}>
        <aside style={styles.sidebar}>
          <div style={styles.filterCard}>
            <h3 style={styles.filterTitle}>Фильтры</h3>

            <div style={styles.field}>
              <label style={styles.label}>Поиск</label>
              <input
                type="text"
                placeholder="Название, город, кто привёз, заметка..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Страна</label>
              <select
                value={countryIsoFilter}
                onChange={(e) => setCountryIsoFilter(e.target.value)}
                style={styles.select}
              >
                <option value="">Все страны</option>
                {countryOptions.map((country) => (
                  <option key={country.iso} value={country.iso}>
                    {country.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Тип кружки</label>
              <select
                value={mugTypeFilter}
                onChange={(e) => setMugTypeFilter(e.target.value)}
                style={styles.select}
              >
                <option value="">Все типы</option>
                {mugTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={hasNoteOnly}
                onChange={(e) => setHasNoteOnly(e.target.checked)}
              />
              <span>Только с заметками</span>
            </label>

            <div style={styles.field}>
              <label style={styles.label}>Сортировка</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={styles.select}
              >
                <option value="received-desc">Сначала новые</option>
                <option value="received-asc">Сначала старые</option>
                <option value="title-asc">Название: А → Я</option>
                <option value="title-desc">Название: Я → А</option>
                <option value="country-asc">Страна: А → Я</option>
              </select>
            </div>

            <button type="button" onClick={resetFilters} style={styles.resetButton}>
              Сбросить фильтры
            </button>
          </div>
        </aside>

        <section style={styles.content}>
          <div style={styles.resultsBar}>
            <div style={styles.resultsLeft}>
              <span style={styles.resultsText}>
                Найдено: <strong>{filteredMugs.length}</strong>
              </span>

              {activeCountryFromFilter && (
                <span style={styles.activeChip}>
                  {activeCountryFromFilter.label}
                </span>
              )}

              {mugTypeFilter && (
                <span style={styles.activeChip}>{mugTypeFilter}</span>
              )}

              {hasNoteOnly && <span style={styles.activeChip}>С заметками</span>}
            </div>
          </div>

          {filteredMugs.length === 0 ? (
            <div style={styles.emptyState}>
              <h3 style={styles.emptyTitle}>Ничего не найдено</h3>
              <p style={styles.emptyText}>
                Попробуйте изменить фильтры или сбросить их полностью.
              </p>
            </div>
          ) : (
            <div style={styles.grid}>
              {filteredMugs.map((mug) => (
                <article key={mug.id} style={styles.card}>
                  <div style={styles.imageWrap}>
                    {mug.mug_images?.length ? (
                      <MugCarousel
                        images={mug.mug_images}
                        fallbackAlt={mug.title || "Кружка"}
                      />
                    ) : (
                      <div style={styles.imageFallback}>Нет фотографий</div>
                    )}
                  </div>

                  <div style={styles.cardBody}>
                    <h3 style={styles.cardTitle}>{mug.title || "Без названия"}</h3>

                    <div style={styles.metaList}>
                      <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>Страна</span>
                        <span style={styles.metaValue}>{mug.countryName}</span>
                      </div>

                      <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>Город</span>
                        <span style={styles.metaValue}>{mug.city || "—"}</span>
                      </div>

                      <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>Тип</span>
                        <span style={styles.metaValue}>{mug.mug_type || "—"}</span>
                      </div>

                      <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>Когда получена</span>
                        <span style={styles.metaValue}>
                          {formatDate(mug.received_at)}
                        </span>
                      </div>

                      <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>Кто привёз</span>
                        <span style={styles.metaValue}>
                          {mug.brought_by || "—"}
                        </span>
                      </div>
                    </div>

                    {mug.note ? (
                      <div style={styles.noteBlock}>
                        <div style={styles.noteTitle}>Заметка</div>
                        <div style={styles.noteText}>{mug.note}</div>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const styles = {
  page: {
    display: "grid",
    gap: "24px",
  },
  headerBlock: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: "32px",
    lineHeight: 1.1,
    color: "#1f2937",
  },
  subtitle: {
    marginTop: "10px",
    marginBottom: 0,
    fontSize: "15px",
    color: "#4b5563",
    maxWidth: "760px",
  },
  topStats: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  topStat: {
    minWidth: "130px",
    padding: "14px 16px",
    borderRadius: "18px",
    background: "#fff8f0",
    border: "1px solid #eadfce",
    display: "grid",
    gap: "4px",
  },
  topStatValue: {
    fontSize: "22px",
    fontWeight: 700,
    color: "#1f2937",
  },
  topStatLabel: {
    fontSize: "13px",
    color: "#6b7280",
  },
  selectedCountryBanner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    padding: "14px 16px",
    borderRadius: "18px",
    background: "#eef6f1",
    border: "1px solid #cfe3d6",
    color: "#1f2937",
  },
  bannerActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  bannerButton: {
    padding: "10px 14px",
    borderRadius: "12px",
    border: "1px solid #1f6f54",
    background: "#1f6f54",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  bannerButtonSecondary: {
    padding: "10px 14px",
    borderRadius: "12px",
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111827",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "280px 1fr",
    gap: "24px",
    alignItems: "start",
  },
  sidebar: {
    position: "sticky",
    top: "24px",
  },
  filterCard: {
    background: "#ffffff",
    borderRadius: "22px",
    padding: "20px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
    border: "1px solid #ececec",
  },
  filterTitle: {
    marginTop: 0,
    marginBottom: "18px",
    fontSize: "22px",
    color: "#111827",
  },
  field: {
    marginBottom: "16px",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    fontSize: "14px",
    fontWeight: 600,
    color: "#374151",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    boxSizing: "border-box",
    background: "#fff",
    outline: "none",
  },
  select: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    boxSizing: "border-box",
    background: "#fff",
    outline: "none",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "16px",
    fontSize: "14px",
    color: "#374151",
    cursor: "pointer",
  },
  resetButton: {
    width: "100%",
    padding: "12px 14px",
    border: "none",
    borderRadius: "12px",
    background: "#1f6f54",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  content: {
    minWidth: 0,
  },
  resultsBar: {
    marginBottom: "18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  resultsLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  resultsText: {
    fontSize: "15px",
    color: "#374151",
  },
  activeChip: {
    padding: "7px 10px",
    borderRadius: "999px",
    background: "#f3f4f6",
    color: "#374151",
    fontSize: "12px",
    fontWeight: 600,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
    gap: "20px",
  },
  card: {
    background: "#fff",
    borderRadius: "22px",
    overflow: "hidden",
    border: "1px solid #ececec",
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
    display: "flex",
    flexDirection: "column",
  },
  imageWrap: {
    width: "100%",
    minHeight: "250px",
    background: "#f3f4f6",
  },
  imageFallback: {
    minHeight: "250px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#6b7280",
    fontSize: "14px",
    background: "#f3f4f6",
  },
  cardBody: {
    padding: "16px",
    display: "grid",
    gap: "14px",
  },
  cardTitle: {
    margin: 0,
    fontSize: "19px",
    lineHeight: 1.3,
    color: "#111827",
  },
  metaList: {
    display: "grid",
    gap: "9px",
  },
  metaItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
  },
  metaLabel: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#6b7280",
    flexShrink: 0,
  },
  metaValue: {
    fontSize: "14px",
    color: "#1f2937",
    textAlign: "right",
  },
  noteBlock: {
    padding: "12px",
    borderRadius: "14px",
    background: "#faf7f2",
    border: "1px solid #efe8dc",
  },
  noteTitle: {
    marginBottom: "6px",
    fontSize: "12px",
    fontWeight: 700,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  noteText: {
    fontSize: "14px",
    color: "#374151",
    lineHeight: 1.5,
  },
  emptyState: {
    background: "#fff",
    borderRadius: "22px",
    padding: "36px",
    border: "1px solid #ececec",
    textAlign: "center",
  },
  emptyTitle: {
    marginTop: 0,
    marginBottom: "10px",
    fontSize: "22px",
    color: "#111827",
  },
  emptyText: {
    margin: 0,
    color: "#6b7280",
    fontSize: "15px",
  },
};