import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import CountriesAdmin from "./components/CountriesAdmin";
import MugsAdmin from "./components/MugsAdmin";
import MugCarousel from "./components/MugCarousel";
import GlobeMapAsync from "./components/GlobeMapAsync";
import CatalogPage from "./components/CatalogPage";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";

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

function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px",
        borderRadius: "999px",
        background: "#f5efe6",
        border: "1px solid #eadfce",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
      }}
    >
      <button
        type="button"
        onClick={() => setLanguage("ru")}
        style={{
          border: "none",
          borderRadius: "999px",
          padding: "8px 14px",
          cursor: "pointer",
          fontWeight: 600,
          background: language === "ru" ? "#1f6f54" : "transparent",
          color: language === "ru" ? "#ffffff" : "#1f2937",
          transition: "all 0.2s ease",
        }}
      >
        RU
      </button>

      <button
        type="button"
        onClick={() => setLanguage("en")}
        style={{
          border: "none",
          borderRadius: "999px",
          padding: "8px 14px",
          cursor: "pointer",
          fontWeight: 600,
          background: language === "en" ? "#1f6f54" : "transparent",
          color: language === "en" ? "#ffffff" : "#1f2937",
          transition: "all 0.2s ease",
        }}
      >
        EN
      </button>
    </div>
  );
}

function AppContent() {
  const { language, t } = useLanguage();

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
      name:
        language === "en"
          ? country.name_en || country.name_ru || country.iso2_code || ""
          : country.name_ru || country.name_en || country.iso2_code || "",
      nameRu: country.name_ru || "",
      nameEn: country.name_en || "",
      hasStarbucks: !!country.has_starbucks_current,
      mugsCount: mugCountByCountryId.get(country.id) ?? 0,
    }));
  }, [countries, mugCountByCountryId, language]);

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

  function getCountryDisplayName(country) {
    if (!country) return "—";

    return language === "en"
      ? country.name_en || country.name_ru || country.iso2_code || "—"
      : country.name_ru || country.name_en || country.iso2_code || "—";
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

  function renderLoading() {
    return (
      <div className="card">
        <div className="empty-state">
          <h2>{t("loadingTitle")}</h2>
          <p>{t("loadingText")}</p>
        </div>
      </div>
    );
  }

  function renderError() {
    return (
      <div className="card">
        <div className="empty-state">
          <h2>{t("errorTitle")}</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header
        className="hero"
        style={{
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "24px",
            right: "24px",
            zIndex: 5,
          }}
        >
          <LanguageSwitch />
        </div>

        <div
          style={{
            paddingRight: "170px",
          }}
        >
          <p className="eyebrow">Khodar Starbucks Collection</p>
          <h1>{t("heroTitle")}</h1>
          <p className="hero-text">{t("heroText")}</p>
        </div>

        <div className="stats">
          <div className="stat">
            <span className="stat-value">{mugs.length}</span>
            <span className="stat-label">{t("publishedMugs")}</span>
          </div>

          <div className="stat">
            <span className="stat-value">{countriesWithStarbucksCount}</span>
            <span className="stat-label">{t("countriesWithStarbucks")}</span>
          </div>

          <div className="stat">
            <span className="stat-value">{countriesWithMugsCount}</span>
            <span className="stat-label">{t("countriesWithMugs")}</span>
          </div>
        </div>

        <div className="legend">
          <div className="legend-item">
            <span className="legend-dot legend-dot-gray" />
            <span>{t("legendNoStarbucks")}</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot legend-dot-light" />
            <span>{t("legendStarbucksNoMugs")}</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot legend-dot-green" />
            <span>{t("legendHasMugs")}</span>
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
            {t("map")}
          </button>

          <button
            className={
              currentView === "catalog"
                ? "view-switch-button active"
                : "view-switch-button"
            }
            onClick={() => setCurrentView("catalog")}
            type="button"
          >
            {t("catalog")}
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
            {t("countries")}
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
            {t("mugs")}
          </button>
        </div>
      </header>

      {currentView === "countries" ? (
        <CountriesAdmin onChanged={loadData} />
      ) : currentView === "mugs" ? (
        <MugsAdmin onChanged={loadData} />
      ) : currentView === "catalog" ? (
        loading ? (
          renderLoading()
        ) : error ? (
          renderError()
        ) : (
          <CatalogPage
            mugs={mugs}
            countries={countries}
            selectedCountryIso={selectedCountryIso}
            selectedCountryLabel={selectedCountryLabel}
          />
        )
      ) : loading ? (
        renderLoading()
      ) : error ? (
        renderError()
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
              <div className="section-title">{t("globe3d")}</div>
            </div>

            {renderMap()}
          </section>

          <aside className="card side-card">
            {!visibleCountryLabel ? (
              <div className="empty-state">
                <h2>{t("hoverCountryTitle")}</h2>
                <p>{t("hoverCountryText")}</p>
              </div>
            ) : !activeCountryRecord ? (
              <div className="empty-state">
                <h2>{visibleCountryLabel}</h2>
                <p>{t("countryNotMatched")}</p>
              </div>
            ) : (
              <>
                <div className="section-title">
                  {getCountryDisplayName(activeCountryRecord)}
                </div>

                <div className="country-panel-actions">
                  {selectedCountryLabel ? (
                    <>
                      <span className="selection-badge">{t("selectedCountry")}</span>
                      <button
                        className="secondary-button"
                        onClick={clearSelectedCountry}
                        type="button"
                      >
                        {t("clearSelection")}
                      </button>
                    </>
                  ) : (
                    <span className="selection-hint">{t("hoverHint")}</span>
                  )}
                </div>

                <div className="country-status-block">
                  <div className="status-row">
                    <span className="status-label">{t("iso")}:</span>
                    <span className="status-value">
                      {activeCountryRecord.iso2_code || "—"}
                    </span>
                  </div>

                  <div className="status-row">
                    <span className="status-label">{t("starbucks")}:</span>
                    <span
                      className={
                        activeCountryRecord.has_starbucks_current
                          ? "status-badge status-badge-light"
                          : "status-badge status-badge-gray"
                      }
                    >
                      {activeCountryRecord.has_starbucks_current
                        ? t("yes")
                        : t("no")}
                    </span>
                  </div>

                  <div className="status-row">
                    <span className="status-label">{t("mugsInCollection")}:</span>
                    <span className="status-value">{activeMugs.length}</span>
                  </div>
                </div>

                {activeMugs.length === 0 ? (
                  <div className="empty-state">
                    {activeCountryRecord.has_starbucks_current ? (
                      <p>{t("noMugsButStarbucks")}</p>
                    ) : (
                      <p>{t("noStarbucksNow")}</p>
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
                              <strong>{t("city")}:</strong> {mug.city || "—"}
                            </p>
                            <p>
                              <strong>{t("type")}:</strong> {mug.mug_type || "—"}
                            </p>
                            <p>
                              <strong>{t("receivedAt")}:</strong>{" "}
                              {formatDate(mug.received_at)}
                            </p>
                            <p>
                              <strong>{t("broughtBy")}:</strong>{" "}
                              {mug.brought_by || "—"}
                            </p>
                            <p>
                              <strong>{t("note")}:</strong> {mug.note || "—"}
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

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;