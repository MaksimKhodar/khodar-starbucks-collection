import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import CountriesAdmin from "./components/CountriesAdmin";
import MugsAdmin from "./components/MugsAdmin";
import MugCarousel from "./components/MugCarousel";
import GlobeMapAsync from "./components/GlobeMapAsync";

function formatDate(value) {
  if (!value) return "—";
  return value.slice(0, 7);
}

function normalizeIso2(value) {
  return (value || "").toUpperCase().trim();
}

function extractCountryPayload(arg1, arg2) {
  if (arg1 && typeof arg1 === "object") {
    return {
      iso: normalizeIso2(arg1.code || arg1.iso || arg1.countryCode || ""),
      label: arg1.name || arg1.label || arg1.countryName || "",
    };
  }

  return {
    iso: normalizeIso2(arg1 || ""),
    label: arg2 || "",
  };
}

function App() {
  const [countries, setCountries] = useState([]);
  const [mugs, setMugs] = useState([]);

  const [hoveredCountryIso, setHoveredCountryIso] = useState("");
  const [hoveredCountryLabel, setHoveredCountryLabel] = useState("");
  const [selectedCountryIso, setSelectedCountryIso] = useState("");
  const [selectedCountryLabel, setSelectedCountryLabel] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentView, setCurrentView] = useState("map");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    const [countriesResult, mugsResult] = await Promise.all([
      supabase
        .from("countries")
        .select(
          "id, iso2_code, name_en, name_ru, has_starbucks_current, is_visible"
        )
        .eq("is_visible", true)
        .order("name_en", { ascending: true }),

      supabase
        .from("mugs")
        .select(`
          id,
          country_id,
          slug,
          title,
          city,
          mug_type,
          received_at,
          brought_by,
          note,
          cover_image_path,
          is_published,
          mug_images (
            id,
            mug_id,
            storage_path,
            sort_order,
            alt_text,
            created_at
          )
        `)
        .eq("is_published", true)
        .order("received_at", { ascending: false }),
    ]);

    if (countriesResult.error) {
      setError(countriesResult.error.message);
      setLoading(false);
      return;
    }

    if (mugsResult.error) {
      setError(mugsResult.error.message);
      setLoading(false);
      return;
    }

    setCountries(countriesResult.data ?? []);
    setMugs(mugsResult.data ?? []);
    setLoading(false);
  }

  const countriesByIso = useMemo(() => {
    const map = new Map();

    countries.forEach((country) => {
      const iso = normalizeIso2(country.iso2_code);
      if (iso) {
        map.set(iso, country);
      }
    });

    return map;
  }, [countries]);

  const mugCountByCountryId = useMemo(() => {
    const map = new Map();

    mugs.forEach((mug) => {
      map.set(mug.country_id, (map.get(mug.country_id) ?? 0) + 1);
    });

    return map;
  }, [mugs]);

  const mugsByCountryId = useMemo(() => {
    const map = new Map();

    mugs.forEach((mug) => {
      const current = map.get(mug.country_id) ?? [];
      current.push(mug);
      map.set(mug.country_id, current);
    });

    return map;
  }, [mugs]);

  const countriesWithMugsCount = useMemo(() => {
    let count = 0;

    countries.forEach((country) => {
      if ((mugCountByCountryId.get(country.id) ?? 0) > 0) {
        count += 1;
      }
    });

    return count;
  }, [countries, mugCountByCountryId]);

  const countriesWithStarbucksCount = useMemo(() => {
    return countries.filter((country) => country.has_starbucks_current).length;
  }, [countries]);

  const globeCountryData = useMemo(() => {
    return countries.map((country) => ({
      id: country.id,
      code: normalizeIso2(country.iso2_code),
      name: country.name_ru || country.name_en || country.iso2_code || "",
      nameRu: country.name_ru || "",
      nameEn: country.name_en || "",
      hasStarbucks: !!country.has_starbucks_current,
      mugsCount: mugCountByCountryId.get(country.id) ?? 0,
    }));
  }, [countries, mugCountByCountryId]);

  const visibleCountryIso = selectedCountryIso || hoveredCountryIso;
  const visibleCountryLabel = selectedCountryLabel || hoveredCountryLabel;

  const activeCountryRecord = visibleCountryIso
    ? countriesByIso.get(visibleCountryIso) ?? null
    : null;

  const activeMugs = activeCountryRecord
    ? mugsByCountryId.get(activeCountryRecord.id) ?? []
    : [];

  function handleCountryHover(arg1, arg2) {
    const { iso, label } = extractCountryPayload(arg1, arg2);
    setHoveredCountryIso(iso);
    setHoveredCountryLabel(label);
  }

  function handleCountryClick(arg1, arg2) {
    const { iso, label } = extractCountryPayload(arg1, arg2);

    const isSameSelection =
      selectedCountryIso === iso && selectedCountryLabel === label;

    if (isSameSelection) {
      setSelectedCountryIso("");
      setSelectedCountryLabel("");
      return;
    }

    setSelectedCountryIso(iso);
    setSelectedCountryLabel(label);
  }

  function clearSelectedCountry() {
    setSelectedCountryIso("");
    setSelectedCountryLabel("");
  }

  function renderMap() {
    const globeMapProps = {
      countryData: globeCountryData,
      selectedCountryCode: selectedCountryIso,
      hoveredCountryCode: hoveredCountryIso,
      onCountryHover: handleCountryHover,
      onCountryClick: handleCountryClick,
      isActive: true,
    };

    return (
      <div
        style={{
          position: "relative",
          minHeight: 560,
          height: "min(70vh, 760px)",
          width: "100%",
          overflow: "hidden",
          borderRadius: "24px",
          background: "#efe7dc",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
          }}
        >
          <GlobeMapAsync {...globeMapProps} />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Khodar Starbucks Collection</p>
        <h1>Интерактивная карта моей коллекции кружек Starbucks</h1>
        <p className="hero-text">
          Открыта 3D-карта коллекции. Наведите курсор на страну или кликните по
          ней — справа появится статус страны и список кружек, если они есть.
        </p>

        <div className="stats">
          <div className="stat">
            <span className="stat-value">{mugs.length}</span>
            <span className="stat-label">опубликованных кружек</span>
          </div>

          <div className="stat">
            <span className="stat-value">{countriesWithStarbucksCount}</span>
            <span className="stat-label">стран со Starbucks</span>
          </div>

          <div className="stat">
            <span className="stat-value">{countriesWithMugsCount}</span>
            <span className="stat-label">стран с кружками</span>
          </div>
        </div>

        <div className="legend">
          <div className="legend-item">
            <span className="legend-dot legend-dot-gray" />
            <span>Starbucks нет</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot legend-dot-light" />
            <span>Starbucks есть, кружек пока нет</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot legend-dot-green" />
            <span>Есть кружки из страны</span>
          </div>
        </div>

        <div className="view-switch">
          <button
            className={
              currentView === "map"
                ? "view-switch-button active"
                : "view-switch-button"
            }
            onClick={() => setCurrentView("map")}
            type="button"
          >
            Карта
          </button>

          <button
            className={
              currentView === "countries"
                ? "view-switch-button active"
                : "view-switch-button"
            }
            onClick={() => setCurrentView("countries")}
            type="button"
          >
            Страны
          </button>

          <button
            className={
              currentView === "mugs"
                ? "view-switch-button active"
                : "view-switch-button"
            }
            onClick={() => setCurrentView("mugs")}
            type="button"
          >
            Кружки
          </button>
        </div>
      </header>

      {currentView === "countries" ? (
        <CountriesAdmin onChanged={loadData} />
      ) : currentView === "mugs" ? (
        <MugsAdmin onChanged={loadData} />
      ) : loading ? (
        <div className="card">
          <div className="empty-state">
            <h2>Загрузка данных…</h2>
            <p>Получаем страны и кружки из базы данных.</p>
          </div>
        </div>
      ) : error ? (
        <div className="card">
          <div className="empty-state">
            <h2>Ошибка загрузки</h2>
            <p>{error}</p>
          </div>
        </div>
      ) : (
        <main className="layout">
          <section className="card map-card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap",
                marginBottom: "12px",
              }}
            >
              <div className="section-title">Глобус 3D</div>
            </div>

            {renderMap()}
          </section>

          <aside className="card side-card">
            {!visibleCountryLabel ? (
              <div className="empty-state">
                <h2>Наведите курсор на страну</h2>
                <p>Здесь будет показываться её статус и кружки.</p>
              </div>
            ) : !activeCountryRecord ? (
              <div className="empty-state">
                <h2>{visibleCountryLabel}</h2>
                <p>
                  Эта страна пока не заведена в базе данных или не сопоставилась
                  с ISO-кодом карты.
                </p>
              </div>
            ) : (
              <>
                <div className="section-title">
                  {activeCountryRecord.name_ru || activeCountryRecord.name_en}
                </div>

                <div className="country-panel-actions">
                  {selectedCountryLabel ? (
                    <>
                      <span className="selection-badge">Страна выбрана</span>
                      <button
                        className="secondary-button"
                        onClick={clearSelectedCountry}
                        type="button"
                      >
                        Снять выбор
                      </button>
                    </>
                  ) : (
                    <span className="selection-hint">
                      Наведение временное. Кликните по стране, чтобы закрепить
                      её.
                    </span>
                  )}
                </div>

                <div className="country-status-block">
                  <div className="status-row">
                    <span className="status-label">ISO:</span>
                    <span className="status-value">
                      {activeCountryRecord.iso2_code || "—"}
                    </span>
                  </div>

                  <div className="status-row">
                    <span className="status-label">Starbucks:</span>
                    <span
                      className={
                        activeCountryRecord.has_starbucks_current
                          ? "status-badge status-badge-light"
                          : "status-badge status-badge-gray"
                      }
                    >
                      {activeCountryRecord.has_starbucks_current ? "есть" : "нет"}
                    </span>
                  </div>

                  <div className="status-row">
                    <span className="status-label">Кружек в коллекции:</span>
                    <span className="status-value">{activeMugs.length}</span>
                  </div>
                </div>

                {activeMugs.length === 0 ? (
                  <div className="empty-state">
                    {activeCountryRecord.has_starbucks_current ? (
                      <p>
                        В этой стране Starbucks есть, но кружек в вашей
                        коллекции пока нет.
                      </p>
                    ) : (
                      <p>
                        В этой стране Starbucks сейчас отмечен как отсутствующий.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="side-scroll-area">
                    <div className="mug-list">
                      {activeMugs.map((mug) => (
                        <article className="mug-card" key={mug.id}>
                          <MugCarousel
                            images={mug.mug_images || []}
                            fallbackAlt={mug.title}
                          />

                          <div className="mug-content">
                            <h3>{mug.title}</h3>
                            <p>
                              <strong>Город:</strong> {mug.city || "—"}
                            </p>
                            <p>
                              <strong>Тип:</strong> {mug.mug_type || "—"}
                            </p>
                            <p>
                              <strong>Когда получена:</strong>{" "}
                              {formatDate(mug.received_at)}
                            </p>
                            <p>
                              <strong>Кто привёз:</strong>{" "}
                              {mug.brought_by || "—"}
                            </p>
                            <p>
                              <strong>Заметка:</strong> {mug.note || "—"}
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </aside>
        </main>
      )}
    </div>
  );
}

export default App;