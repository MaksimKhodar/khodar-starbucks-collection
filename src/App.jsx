import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import CountriesAdmin from "./components/CountriesAdmin";
import ErrorBoundary from "./components/ErrorBoundary";
import MugsAdmin from "./components/MugsAdmin";
import MugCarousel from "./components/MugCarousel";
import GlobeMapAsync from "./components/GlobeMapAsync";
import CatalogPage from "./components/CatalogPage";
import PeopleVisualization from "./components/PeopleVisualization";
import PeopleAdmin from "./components/PeopleAdmin";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import { normalizeIso2, formatDate } from "./lib/utils";

function extractCountryPayload(payload) {
  if (!payload) {
    return { iso: "", label: "" };
  }

  if (typeof payload === "object") {
    return {
      iso: normalizeIso2(
        payload.code || payload.iso || payload.countryCode || ""
      ),
      label: payload.name || payload.label || payload.countryName || "",
    };
  }

  return {
    iso: normalizeIso2(String(payload || "")),
    label: "",
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
  const [cities, setCities] = useState([]);
  const [mugs, setMugs] = useState([]);
  const [people, setPeople] = useState([]);

  const [hoveredCountryIso, setHoveredCountryIso] = useState("");
  const [hoveredCountryLabel, setHoveredCountryLabel] = useState("");
  const [selectedCountryIso, setSelectedCountryIso] = useState("");
  const [selectedCountryLabel, setSelectedCountryLabel] = useState("");

  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState("");
  const [warningMessage, setWarningMessage] = useState("");
  const [currentView, setCurrentView] = useState("map");

  const tryLoadTable = useCallback(async (queryFn, retryQueryFn = null) => {
    const result = await queryFn();

    if (!result.error) {
      return result;
    }

    const shouldRetry =
      retryQueryFn &&
      /(column .* does not exist|undefined column|relation .* does not exist|таблица .* не существует|Нет столбца)/i.test(
        String(result.error.message || "")
      );

    if (shouldRetry) {
      return retryQueryFn();
    }

    return result;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setFatalError("");
    setWarningMessage("");

    const [countriesResult, mugsResult, peopleResult, citiesResult] =
      await Promise.all([
        tryLoadTable(
          () =>
            supabase
              .from("countries")
              .select(
                "id, iso2_code, name_en, name_ru, has_starbucks_current, is_visible"
              )
              .eq("is_visible", true)
              .order("name_en", { ascending: true }),
          () =>
            supabase
              .from("countries")
              .select("id, iso2_code, name_en, name_ru, has_starbucks_current")
              .order("name_en", { ascending: true })
        ),

        tryLoadTable(
          () =>
            supabase
              .from("mugs")
              .select(`
                id,
                country_id,
                city_id,
                slug,
                title,
                city,
                city_key,
                mug_type,
                received_at,
                brought_by,
                brought_by_person_ids,
                brought_by_person_id,
                color_keys,
                collection_keys,
                note,
                cover_image_path,
                is_published,
                created_at,
                updated_at,
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
          () =>
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
              .order("received_at", { ascending: false })
        ),

        tryLoadTable(
          () =>
            supabase
              .from("people")
              .select(
                "id, first_name, last_name, bio, avatar_image_path, instagram_url, is_visible"
              )
              .eq("is_visible", true)
              .order("first_name", { ascending: true }),
          () =>
            supabase
              .from("people")
              .select(
                "id, first_name, last_name, bio, avatar_image_path, instagram_url"
              )
              .order("first_name", { ascending: true })
        ),

        tryLoadTable(
          () =>
            supabase
              .from("cities")
              .select(
                "id, key, country_id, name_en, name_ru, latitude, longitude, is_active"
              )
              .eq("is_active", true)
              .order("name_en", { ascending: true }),
          () =>
            supabase
              .from("cities")
              .select(
                "id, key, country_id, name_en, name_ru, latitude, longitude"
              )
              .order("name_en", { ascending: true })
        ),
      ]);

    if (countriesResult.error || mugsResult.error) {
      setFatalError(
        countriesResult.error?.message ||
          mugsResult.error?.message ||
          "Не удалось загрузить страны и кружки."
      );
      setCountries([]);
      setMugs([]);
      setPeople([]);
      setCities([]);
      setLoading(false);
      return;
    }

    setCountries(countriesResult.data ?? []);
    setMugs(mugsResult.data ?? []);
    setPeople(peopleResult.error ? [] : peopleResult.data ?? []);
    setCities(citiesResult.error ? [] : citiesResult.data ?? []);

    const warnings = [
      peopleResult.error ? `People: ${peopleResult.error.message}` : null,
      citiesResult.error ? `Cities: ${citiesResult.error.message}` : null,
    ].filter(Boolean);

    setWarningMessage(warnings.join(" / "));
    setLoading(false);
  }, [tryLoadTable]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        await loadData();
      } catch (unexpectedError) {
        if (!cancelled) {
          console.error("Unexpected data fetch error:", unexpectedError);
          setFatalError(
            unexpectedError?.message ||
              "Не удалось загрузить данные. Пожалуйста, попробуйте позже."
          );
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [loadData]);

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

  const citiesById = useMemo(() => {
    const map = new Map();

    cities.forEach((city) => {
      map.set(String(city.id), city);
    });

    return map;
  }, [cities]);

  const mugCountByCountryId = useMemo(() => {
    const map = new Map();

    mugs.forEach((mug) => {
      const key = String(mug.country_id || "");
      if (!key) return;
      map.set(key, (map.get(key) ?? 0) + 1);
    });

    return map;
  }, [mugs]);

  const mugsByCountryId = useMemo(() => {
    const map = new Map();

    mugs.forEach((mug) => {
      const key = String(mug.country_id || "");
      if (!key) return;

      const current = map.get(key) ?? [];
      current.push(mug);
      map.set(key, current);
    });

    return map;
  }, [mugs]);

  const countriesWithMugsCount = useMemo(() => {
    let count = 0;

    countries.forEach((country) => {
      const mugCount = mugCountByCountryId.get(String(country.id)) ?? 0;
      if (mugCount > 0) {
        count += 1;
      }
    });

    return count;
  }, [countries, mugCountByCountryId]);

  const countriesWithStarbucksCount = useMemo(() => {
    return countries.filter((country) => !!country.has_starbucks_current).length;
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
      mugsCount: mugCountByCountryId.get(String(country.id)) ?? 0,
    }));
  }, [countries, mugCountByCountryId, language]);

  const visibleCountryIso = selectedCountryIso || hoveredCountryIso;
  const visibleCountryLabel = selectedCountryLabel || hoveredCountryLabel;

  const activeCountryRecord = useMemo(() => {
    if (!visibleCountryIso) return null;
    return countriesByIso.get(visibleCountryIso) ?? null;
  }, [countriesByIso, visibleCountryIso]);

  const activeMugs = useMemo(() => {
    if (!activeCountryRecord) return [];
    return mugsByCountryId.get(String(activeCountryRecord.id)) ?? [];
  }, [activeCountryRecord, mugsByCountryId]);

  const peopleAdminLabel = language === "en" ? "People Admin" : "Люди: админка";

  const handleCountryHover = useCallback(
    (payload) => {
      if (selectedCountryIso) {
        return;
      }

      const { iso, label } = extractCountryPayload(payload);
      setHoveredCountryIso(iso);
      setHoveredCountryLabel(label);
    },
    [selectedCountryIso]
  );

  const handleCountryClick = useCallback(
    (payload) => {
      const { iso, label } = extractCountryPayload(payload);

      if (!iso) {
        setSelectedCountryIso("");
        setSelectedCountryLabel("");
        setHoveredCountryIso("");
        setHoveredCountryLabel("");
        return;
      }

      const isSameSelection = selectedCountryIso === iso;

      if (isSameSelection) {
        setSelectedCountryIso("");
        setSelectedCountryLabel("");
        return;
      }

      setSelectedCountryIso(iso);
      setSelectedCountryLabel(label);
      setHoveredCountryIso("");
      setHoveredCountryLabel("");
    },
    [selectedCountryIso]
  );

  const clearSelectedCountry = useCallback(() => {
    setSelectedCountryIso("");
    setSelectedCountryLabel("");
    setHoveredCountryIso("");
    setHoveredCountryLabel("");
  }, []);

  const getCountryDisplayName = useCallback(
    (country) => {
      if (!country) return "—";

      return language === "en"
        ? country.name_en || country.name_ru || country.iso2_code || "—"
        : country.name_ru || country.name_en || country.iso2_code || "—";
    },
    [language]
  );

  const getMugCityText = useCallback(
    (mug) => {
      if (!mug) return "—";

      const city = citiesById.get(String(mug.city_id || ""));
      if (city) {
        return language === "en"
          ? city.name_en || city.name_ru || mug.city || "—"
          : city.name_ru || city.name_en || mug.city || "—";
      }

      return mug.city || "—";
    },
    [citiesById, language]
  );

  const renderLoading = useCallback(() => {
    return (
      <div className="card">
        <div className="empty-state">
          <h2>{t("loadingTitle")}</h2>
          <p>{t("loadingText")}</p>
        </div>
      </div>
    );
  }, [t]);

  const renderError = useCallback(() => {
    return (
      <div className="card">
        <div className="empty-state">
          <h2>{t("errorTitle")}</h2>
          <p>{fatalError || t("errorText")}</p>
          <button
            type="button"
            className="secondary-button"
            onClick={loadData}
            style={{ marginTop: 16 }}
          >
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }, [fatalError, loadData, t]);

  const warningBanner =
    warningMessage && !loading && !fatalError ? (
      <div
        className="card"
        style={{
          padding: "14px 16px",
          border: "1px solid #f3d5a3",
          background: "#fff8ea",
          color: "#7a4b00",
          marginBottom: 16,
        }}
      >
        {warningMessage}
      </div>
    ) : null;

  const isAdminView =
    currentView === "countries" ||
    currentView === "mugs" ||
    currentView === "people-admin";

  return (
    <div className="page">
      <header className="hero hero-with-language">
        <div className="hero-language-switch">
          <LanguageSwitch />
        </div>

        <div className="hero-main-content">
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
              currentView === "people"
                ? "view-switch-button active"
                : "view-switch-button"
            }
            onClick={() => setCurrentView("people")}
            type="button"
          >
            {t("people")}
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

          <button
            className={
              currentView === "people-admin"
                ? "view-switch-button active"
                : "view-switch-button"
            }
            onClick={() => setCurrentView("people-admin")}
            type="button"
          >
            {peopleAdminLabel}
          </button>
        </div>
      </header>

      {isAdminView ? (
        currentView === "countries" ? (
          <CountriesAdmin onChanged={loadData} />
        ) : currentView === "mugs" ? (
          <MugsAdmin onChanged={loadData} />
        ) : (
          <PeopleAdmin onChanged={loadData} />
        )
      ) : loading ? (
        renderLoading()
      ) : fatalError ? (
        renderError()
      ) : (
        <>
          {warningBanner}

          <div style={{ display: currentView === "map" ? "block" : "none" }}>
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
                  <div style={{ position: "absolute", inset: 0 }}>
                    <GlobeMapAsync
                      countryData={globeCountryData}
                      selectedCountryCode={selectedCountryIso}
                      hoveredCountryCode={
                        selectedCountryIso ? "" : hoveredCountryIso
                      }
                      onCountryHover={handleCountryHover}
                      onCountryClick={handleCountryClick}
                      isActive={currentView === "map"}
                    />
                  </div>
                </div>
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
                          <span className="selection-badge">
                            {t("selectedCountry")}
                          </span>

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
                        <span className="status-label">
                          {t("mugsInCollection")}:
                        </span>
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
                                  <strong>{t("city")}:</strong>{" "}
                                  {getMugCityText(mug)}
                                </p>

                                <p>
                                  <strong>{t("type")}:</strong>{" "}
                                  {mug.mug_type || "—"}
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
                                  <strong>{t("note")}:</strong>{" "}
                                  {mug.note || "—"}
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
          </div>

          <div style={{ display: currentView === "catalog" ? "block" : "none" }}>
            <CatalogPage
              mugs={mugs}
              countries={countries}
              cities={cities}
              people={people}
              selectedCountryIso={selectedCountryIso}
              selectedCountryLabel={selectedCountryLabel}
              language={language}
            />
          </div>

          <div style={{ display: currentView === "people" ? "block" : "none" }}>
            <PeopleVisualization
              mugs={mugs}
              countries={countries}
              cities={cities}
              people={people}
            />
          </div>
        </>
      )}
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </LanguageProvider>
  );
}

export default App;