import { useMemo, useState } from "react";
import MugCarousel from "./MugCarousel";
import PersonDetailModal from "./PersonDetailModal";
import { translations } from "../i18n/translations";
import { formatDate, normalizeIso2 } from "../lib/utils";
import {
  COLOR_OPTIONS,
  ensureArray,
  buildTypeOptions,
  getCityDisplayName,
  getColorLabels,
  getLocalizedOptionLabel,
  getTypeLabels,
  getTypeValues,
  buildCityFilterValue,
} from "../data/mugMetadata";

function getLocalizedValue(value, language = "ru") {
  if (value == null) return "";

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    return value[language] || value.ru || value.en || "";
  }

  return String(value);
}

function getSearchableValue(value) {
  if (value == null) return "";

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    return Object.values(value).filter(Boolean).join(" ");
  }

  return String(value);
}

function tr(language, key, fallback, vars = {}) {
  const locale = translations[language] || translations.ru || {};
  const ru = translations.ru || {};

  let value = locale[key] ?? ru[key] ?? fallback ?? key;

  Object.entries(vars).forEach(([varKey, varValue]) => {
    value = String(value).replaceAll(`{{${varKey}}}`, String(varValue));
  });

  return value;
}

function getUiText(language = "ru") {
  if (language === "en") {
    return {
      filterFromMap: "Filter from map:",
      applyCountry: "Apply country",
      removeCountryFilter: "Remove country filter",
      withNotesChip: "With notes",
      nothingFound: "Nothing found",
      emptyText: "Try changing the filters or resetting them completely.",
      untitledMug: "Untitled mug",
      mugFallbackAlt: "Mug",
      noPhotos: "No photos",
      noNote: "No note",
      unknown: "Not specified",
      sortTitleAsc: "Title: A → Z",
      sortTitleDesc: "Title: Z → A",
      sortCountryAsc: "Country: A → Z",
      sortCityAsc: "City: A → Z",
      allCities: "All cities",
      allColors: "All colors",
      types: "Types",
      colors: "Colors",
      colorChipLabel: "Colors",
      typeChipLabel: "Type",
    };
  }

  return {
    filterFromMap: "Фильтр от карты:",
    applyCountry: "Применить страну",
    removeCountryFilter: "Убрать фильтр страны",
    withNotesChip: "С заметками",
    nothingFound: "Ничего не найдено",
    emptyText: "Попробуйте изменить фильтры или сбросить их полностью.",
    untitledMug: "Без названия",
    mugFallbackAlt: "Кружка",
    noPhotos: "Нет фотографий",
    noNote: "Нет заметки",
    unknown: "Не указано",
    sortTitleAsc: "Название: А → Я",
    sortTitleDesc: "Название: Я → А",
    sortCountryAsc: "Страна: А → Я",
    sortCityAsc: "Город: А → Я",
    allCities: "Все города",
    allColors: "Все цвета",
    types: "Типы",
    colors: "Цвета",
    colorChipLabel: "Цвета",
    typeChipLabel: "Тип",
  };
}

function getCountryLabel(country, language = "ru") {
  if (!country) return "—";

  if (language === "en") {
    return country.name_en || country.name_ru || country.iso2_code || "—";
  }

  return country.name_ru || country.name_en || country.iso2_code || "—";
}

function FilterChipGroup({
  options = [],
  selectedValues = [],
  onToggle,
  language = "ru",
  showSwatch = false,
}) {
  if (!options.length) return null;

  return (
    <div style={styles.chipGroup}>
      {options.map((option) => {
        const optionValue = option.value ?? option.key;
        const optionLabel =
          typeof option.label === "string"
            ? option.label
            : getLocalizedOptionLabel(option, language);
        const active = selectedValues.includes(optionValue);

        return (
          <button
            key={optionValue}
            type="button"
            onClick={() => onToggle(optionValue)}
            style={{
              ...styles.filterChip,
              ...(active ? styles.filterChipActive : null),
            }}
          >
            {showSwatch && option.swatch ? (
              <span
                aria-hidden="true"
                style={{
                  ...styles.colorDot,
                  background: option.swatch,
                }}
              />
            ) : null}
            <span>{optionLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function CatalogPage({
  mugs = [],
  countries = [],
  cities = [],
  people = [],
  selectedCountryIso = "",
  selectedCountryLabel = "",
  language = "ru",
}) {
  const [search, setSearch] = useState("");
  const [countryIsoFilter, setCountryIsoFilter] = useState(null);
  const [cityFilter, setCityFilter] = useState("");
  const [mugTypeFilter, setMugTypeFilter] = useState("");
  const [colorFilterKeys, setColorFilterKeys] = useState([]);
  const [hasNoteOnly, setHasNoteOnly] = useState(false);
  const [sortBy, setSortBy] = useState("received-desc");
  const [selectedPerson, setSelectedPerson] = useState(null);

  const ui = useMemo(() => getUiText(language), [language]);
  const locale = language === "en" ? "en" : "ru";
  const effectiveCountryFilter =
    countryIsoFilter == null ? normalizeIso2(selectedCountryIso) : countryIsoFilter;

  const countriesById = useMemo(() => {
    const map = new Map();

    countries.forEach((country) => {
      map.set(country.id, country);
    });

    return map;
  }, [countries]);

  const peopleById = useMemo(() => {
    const map = new Map();

    people.forEach((person) => {
      map.set(person.id, person);
    });

    return map;
  }, [people]);

  const citiesById = useMemo(() => {
    const map = new Map();

    cities.forEach((city) => {
      map.set(city.id, city);
    });

    return map;
  }, [cities]);

  const countryOptions = useMemo(() => {
    return countries
      .map((country) => ({
        id: country.id,
        iso: normalizeIso2(country.iso2_code),
        label: getCountryLabel(country, language),
      }))
      .filter((country) => country.iso)
      .sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [countries, language, locale]);

  const mugTypeOptions = useMemo(() => {
    const existingValues = mugs.flatMap((mug) =>
      getTypeValues(mug.collection_keys, mug.mug_type)
    );

    return buildTypeOptions({
      existingValues,
      language,
    });
  }, [mugs, language]);

  const preparedMugs = useMemo(() => {
    return mugs.map((mug) => {
      const country = countriesById.get(mug.country_id);
      const countryIso = normalizeIso2(country?.iso2_code);
      const city = citiesById.get(mug.city_id);

      const mugPeople = Array.isArray(mug.brought_by_person_ids)
        ? mug.brought_by_person_ids
            .map((personId) => peopleById.get(personId))
            .filter(Boolean)
        : mug.brought_by_person_id && peopleById.get(mug.brought_by_person_id)
        ? [peopleById.get(mug.brought_by_person_id)]
        : [];

      const cityText = city
        ? language === "en"
          ? city.name_en || city.name_ru || mug.city || ""
          : city.name_ru || city.name_en || mug.city || ""
        : getCityDisplayName(mug.city_key, mug.city, language) || getLocalizedValue(mug.city, language);

      const cityFilterValue = city
        ? city.key
        : buildCityFilterValue(mug.city_key, mug.city, countryIso);

      const colorKeys = ensureArray(mug.color_keys);
      const typeValues = getTypeValues(mug.collection_keys, mug.mug_type);
      const colorLabels = getColorLabels(colorKeys, language);
      const typeLabels = getTypeLabels(typeValues, language);

      return {
        ...mug,
        countryIso,
        countryName: getCountryLabel(country, language),
        countryNameRu: country?.name_ru || "",
        countryNameEn: country?.name_en || "",
        titleText: getLocalizedValue(mug.title, language),
        cityText,
        cityFilterValue,
        noteText: getLocalizedValue(mug.note, language),
        broughtByText: getLocalizedValue(mug.brought_by, language),
        colorKeys,
        typeValues,
        colorLabels,
        typeLabels,
        mugPeople,
      };
    });
  }, [mugs, countriesById, peopleById, citiesById, language]);

  const colorFilterOptions = useMemo(() => {
    const existingKeys = new Set();

    preparedMugs.forEach((mug) => {
      mug.colorKeys.forEach((key) => existingKeys.add(key));
    });

    return COLOR_OPTIONS.filter((option) => existingKeys.has(option.key));
  }, [preparedMugs]);

  const cityOptions = useMemo(() => {
    const optionMap = new Map();

    preparedMugs.forEach((mug) => {
      if (!mug.cityText) return;
      if (effectiveCountryFilter && mug.countryIso !== effectiveCountryFilter) return;

      if (!optionMap.has(mug.cityFilterValue)) {
        optionMap.set(mug.cityFilterValue, {
          value: mug.cityFilterValue,
          label: mug.cityText,
        });
      }
    });

    return [...optionMap.values()].sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [preparedMugs, effectiveCountryFilter, locale]);

  const safeCityFilter = cityOptions.some((option) => option.value === cityFilter)
    ? cityFilter
    : "";

  const filteredMugs = useMemo(() => {
    let result = [...preparedMugs];

    if (search.trim()) {
      const query = search.trim().toLowerCase();

      result = result.filter((mug) => {
        const haystack = [
          getSearchableValue(mug.title),
          getSearchableValue(mug.city),
          mug.cityText,
          getSearchableValue(mug.mug_type),
          getSearchableValue(mug.brought_by),
          getSearchableValue(mug.note),
          mug.countryName,
          mug.countryNameRu,
          mug.countryNameEn,
          mug.countryIso,
          mug.slug,
          ...mug.colorLabels,
          ...mug.typeLabels,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      });
    }

    if (effectiveCountryFilter) {
      result = result.filter((mug) => mug.countryIso === effectiveCountryFilter);
    }

    if (safeCityFilter) {
      result = result.filter((mug) => mug.cityFilterValue === safeCityFilter);
    }

    if (mugTypeFilter) {
      result = result.filter((mug) => mug.typeValues.includes(mugTypeFilter));
    }

    if (colorFilterKeys.length > 0) {
      result = result.filter((mug) => {
        return mug.colorKeys.some((colorKey) => colorFilterKeys.includes(colorKey));
      });
    }

    if (hasNoteOnly) {
      result = result.filter((mug) => !!String(mug.noteText || "").trim());
    }

    switch (sortBy) {
      case "title-asc":
        result.sort((a, b) =>
          (a.titleText || "").localeCompare(b.titleText || "", locale)
        );
        break;

      case "title-desc":
        result.sort((a, b) =>
          (b.titleText || "").localeCompare(a.titleText || "", locale)
        );
        break;

      case "country-asc":
        result.sort((a, b) =>
          (a.countryName || "").localeCompare(b.countryName || "", locale)
        );
        break;

      case "city-asc":
        result.sort((a, b) =>
          (a.cityText || "").localeCompare(b.cityText || "", locale)
        );
        break;

      case "received-asc":
        result.sort((a, b) =>
          String(a.received_at || "").localeCompare(String(b.received_at || ""))
        );
        break;

      case "received-desc":
      default:
        result.sort((a, b) =>
          String(b.received_at || "").localeCompare(String(a.received_at || ""))
        );
        break;
    }

    return result;
  }, [
    preparedMugs,
    search,
    effectiveCountryFilter,
    safeCityFilter,
    mugTypeFilter,
    colorFilterKeys,
    hasNoteOnly,
    sortBy,
    locale,
  ]);

  const activeCountryFromFilter = useMemo(() => {
    if (!effectiveCountryFilter) return null;

    return (
      countryOptions.find((country) => country.iso === effectiveCountryFilter) || null
    );
  }, [countryOptions, effectiveCountryFilter]);

  function toggleFilterValue(setter, currentValues, optionKey) {
    setter(
      currentValues.includes(optionKey)
        ? currentValues.filter((value) => value !== optionKey)
        : [...currentValues, optionKey]
    );
  }

  function resetFilters() {
    setSearch("");
    setCountryIsoFilter(null);
    setCityFilter("");
    setMugTypeFilter("");
    setColorFilterKeys([]);
    setHasNoteOnly(false);
    setSortBy("received-desc");
  }

  function clearCountryFilter() {
    setCountryIsoFilter("");
    setCityFilter("");
  }

  return (
    <main style={styles.page}>
      <div style={styles.headerBlock}>
        <div>
          <h2 style={styles.title}>
            {tr(
              language,
              "catalogTitle",
              language === "en" ? "Mug Catalog" : "Каталог кружек"
            )}
          </h2>

          <p style={styles.subtitle}>
            {tr(
              language,
              "catalogSubtitle",
              language === "en"
                ? "Marketplace-style layout: filters on the left, mug cards on the right."
                : "Формат маркетплейса: фильтры слева, карточки кружек справа."
            )}
          </p>
        </div>

        <div style={styles.topStats}>
          <div style={styles.topStat}>
            <span style={styles.topStatValue}>{mugs.length}</span>
            <span style={styles.topStatLabel}>
              {tr(
                language,
                "totalMugs",
                language === "en" ? "total mugs" : "всего кружек"
              )}
            </span>
          </div>

          <div style={styles.topStat}>
            <span style={styles.topStatValue}>{filteredMugs.length}</span>
            <span style={styles.topStatLabel}>
              {tr(
                language,
                "filteredMugs",
                language === "en" ? "after filtering" : "после фильтрации"
              )}
            </span>
          </div>
        </div>
      </div>

      {(selectedCountryIso || selectedCountryLabel) && (
        <div style={styles.selectedCountryBanner}>
          <div>
            <strong>{ui.filterFromMap}</strong>{" "}
            {getLocalizedValue(selectedCountryLabel, language) ||
              activeCountryFromFilter?.label ||
              selectedCountryIso}
          </div>

          <div style={styles.bannerActions}>
            <button
              type="button"
              onClick={() =>
                setCountryIsoFilter(normalizeIso2(selectedCountryIso || ""))
              }
              style={styles.bannerButton}
            >
              {ui.applyCountry}
            </button>

            <button
              type="button"
              onClick={clearCountryFilter}
              style={styles.bannerButtonSecondary}
            >
              {ui.removeCountryFilter}
            </button>
          </div>
        </div>
      )}

      <div style={styles.layout}>
        <aside style={styles.sidebar}>
          <div style={styles.filterCard}>
            <h3 style={styles.filterTitle}>
              {tr(language, "filters", language === "en" ? "Filters" : "Фильтры")}
            </h3>

            <div style={styles.field}>
              <label style={styles.label}>
                {tr(language, "search", language === "en" ? "Search" : "Поиск")}
              </label>

              <input
                type="text"
                placeholder={tr(
                  language,
                  "searchPlaceholder",
                  language === "en"
                    ? "Title, note, who brought it, collection..."
                    : "Название, заметка, кто привёз, тип..."
                )}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                {tr(language, "country", language === "en" ? "Country" : "Страна")}
              </label>

              <select
                value={countryIsoFilter ?? ""}
                onChange={(event) => setCountryIsoFilter(event.target.value)}
                style={styles.select}
              >
                <option value="">
                  {tr(
                    language,
                    "allCountries",
                    language === "en" ? "All countries" : "Все страны"
                  )}
                </option>

                {countryOptions.map((country) => (
                  <option key={country.iso} value={country.iso}>
                    {country.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                {tr(language, "city", language === "en" ? "City" : "Город")}
              </label>

              <select
                value={safeCityFilter}
                onChange={(event) => setCityFilter(event.target.value)}
                style={styles.select}
              >
                <option value="">{ui.allCities}</option>
                {cityOptions.map((city) => (
                  <option key={city.value} value={city.value}>
                    {city.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                {tr(
                  language,
                  "mugType",
                  language === "en" ? "Mug type" : "Тип кружки"
                )}
              </label>

              <select
                value={mugTypeFilter}
                onChange={(event) => setMugTypeFilter(event.target.value)}
                style={styles.select}
              >
                <option value="">
                  {tr(
                    language,
                    "allTypes",
                    language === "en" ? "All types" : "Все типы"
                  )}
                </option>

                {mugTypeOptions.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {colorFilterOptions.length > 0 && (
              <div style={styles.field}>
                <label style={styles.label}>{ui.colors}</label>
                <FilterChipGroup
                  options={colorFilterOptions}
                  selectedValues={colorFilterKeys}
                  onToggle={(optionKey) =>
                    toggleFilterValue(setColorFilterKeys, colorFilterKeys, optionKey)
                  }
                  language={language}
                  showSwatch
                />
              </div>
            )}

            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={hasNoteOnly}
                onChange={(event) => setHasNoteOnly(event.target.checked)}
              />
              <span>
                {tr(
                  language,
                  "onlyWithNotes",
                  language === "en" ? "Only with notes" : "Только с заметками"
                )}
              </span>
            </label>

            <div style={styles.field}>
              <label style={styles.label}>
                {tr(
                  language,
                  "sorting",
                  language === "en" ? "Sorting" : "Сортировка"
                )}
              </label>

              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                style={styles.select}
              >
                <option value="received-desc">
                  {tr(
                    language,
                    "sortNewest",
                    language === "en" ? "Newest first" : "Сначала новые"
                  )}
                </option>

                <option value="received-asc">
                  {tr(
                    language,
                    "sortOldest",
                    language === "en" ? "Oldest first" : "Сначала старые"
                  )}
                </option>

                <option value="title-asc">{ui.sortTitleAsc}</option>
                <option value="title-desc">{ui.sortTitleDesc}</option>
                <option value="country-asc">{ui.sortCountryAsc}</option>
                <option value="city-asc">{ui.sortCityAsc}</option>
              </select>
            </div>

            <button type="button" onClick={resetFilters} style={styles.resetButton}>
              {tr(
                language,
                "resetFilters",
                language === "en" ? "Reset filters" : "Сбросить фильтры"
              )}
            </button>
          </div>
        </aside>

        <section style={styles.content}>
          <div style={styles.resultsBar}>
            <div style={styles.resultsLeft}>
              <span style={styles.resultsText}>
                {tr(
                  language,
                  "found",
                  language === "en" ? "Found: {{count}}" : "Найдено: {{count}}",
                  { count: filteredMugs.length }
                )}
              </span>

              {activeCountryFromFilter && (
                <span style={styles.activeChip}>{activeCountryFromFilter.label}</span>
              )}

              {safeCityFilter &&
                cityOptions
                  .filter((city) => city.value === safeCityFilter)
                  .map((city) => (
                    <span key={city.value} style={styles.activeChip}>
                      {city.label}
                    </span>
                  ))}

              {mugTypeFilter && (
                <span style={styles.activeChip}>
                  {mugTypeOptions.find((option) => option.value === mugTypeFilter)?.label ||
                    mugTypeFilter}
                </span>
              )}

              {colorFilterKeys.map((colorKey) => {
                const option = COLOR_OPTIONS.find((item) => item.key === colorKey);
                if (!option) return null;

                return (
                  <span key={colorKey} style={styles.activeChip}>
                    {ui.colorChipLabel}: {getLocalizedOptionLabel(option, language)}
                  </span>
                );
              })}

              {hasNoteOnly && (
                <span style={styles.activeChip}>{ui.withNotesChip}</span>
              )}
            </div>
          </div>

          {filteredMugs.length === 0 ? (
            <div style={styles.emptyState}>
              <h3 style={styles.emptyTitle}>{ui.nothingFound}</h3>
              <p style={styles.emptyText}>{ui.emptyText}</p>
            </div>
          ) : (
            <div style={styles.grid}>
              {filteredMugs.map((mug) => (
                <article key={mug.id} style={styles.card}>
                  <div style={styles.imageWrap}>
                    {mug.mug_images?.length ? (
                      <MugCarousel
                        images={mug.mug_images}
                        fallbackAlt={mug.titleText || ui.mugFallbackAlt}
                      />
                    ) : (
                      <div style={styles.imageFallback}>
                        {tr(language, "noPhotos", ui.noPhotos)}
                      </div>
                    )}
                  </div>

                  <div style={styles.cardBody}>
                    <h3 style={styles.cardTitle}>
                      {mug.titleText || ui.untitledMug}
                    </h3>

                    {(mug.typeLabels.length > 0 || mug.colorLabels.length > 0) && (
                      <div style={styles.attributeBlock}>
                        {mug.typeLabels.length > 0 && (
                          <div style={styles.attributeSection}>
                            <span style={styles.attributeLabel}>{ui.types}</span>
                            <div style={styles.inlineChips}>
                              {mug.typeLabels.map((label) => (
                                <span key={`${mug.id}-${label}`} style={styles.inlineChip}>
                                  {label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {mug.colorLabels.length > 0 && (
                          <div style={styles.attributeSection}>
                            <span style={styles.attributeLabel}>{ui.colors}</span>
                            <div style={styles.inlineChips}>
                              {mug.colorKeys.map((colorKey) => {
                                const option = COLOR_OPTIONS.find((item) => item.key === colorKey);
                                if (!option) return null;

                                return (
                                  <span key={`${mug.id}-${colorKey}`} style={styles.inlineChip}>
                                    <span
                                      aria-hidden="true"
                                      style={{
                                        ...styles.colorDot,
                                        background: option.swatch,
                                      }}
                                    />
                                    {getLocalizedOptionLabel(option, language)}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div style={styles.metaList}>
                      <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>
                          {tr(
                            language,
                            "country",
                            language === "en" ? "Country" : "Страна"
                          )}
                        </span>
                        <span style={styles.metaValue}>{mug.countryName || "—"}</span>
                      </div>

                      <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>
                          {tr(language, "city", language === "en" ? "City" : "Город")}
                        </span>
                        <span style={styles.metaValue}>{mug.cityText || "—"}</span>
                      </div>

                      <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>
                          {tr(
                            language,
                            "receivedAt",
                            language === "en" ? "Received" : "Когда получена"
                          )}
                        </span>
                        <span style={styles.metaValue}>
                          {formatDate(mug.received_at)}
                        </span>
                      </div>

                      <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>
                          {tr(
                            language,
                            "broughtBy",
                            language === "en" ? "Brought by" : "Кто привёз"
                          )}
                        </span>
                        <span style={styles.metaValue}>
                          {mug.mugPeople && mug.mugPeople.length > 0 ? (
                            <span>
                              {mug.mugPeople.map((person, index) => (
                                <span key={person.id}>
                                  {index > 0 && ", "}
                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setSelectedPerson(person);
                                    }}
                                    style={styles.personLink}
                                  >
                                    {person.first_name} {person.last_name}
                                  </button>
                                </span>
                              ))}
                            </span>
                          ) : (
                            mug.broughtByText || "—"
                          )}
                        </span>
                      </div>
                    </div>

                    <div style={styles.noteBlock}>
                      <div style={styles.noteTitle}>
                        {tr(language, "note", language === "en" ? "Note" : "Заметка")}
                      </div>
                      <div style={styles.noteText}>
                        {mug.noteText || tr(language, "noNote", ui.noNote)}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {selectedPerson && (
        <PersonDetailModal
          person={selectedPerson}
          mugs={mugs}
          countries={countries}
          language={language}
          onClose={() => setSelectedPerson(null)}
        />
      )}
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
    gridTemplateColumns: "320px 1fr",
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
    marginBottom: "18px",
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
    marginBottom: "18px",
    color: "#374151",
  },
  chipGroup: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  filterChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "9px 12px",
    borderRadius: "999px",
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#374151",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 600,
  },
  filterChipActive: {
    background: "#ecf7f1",
    borderColor: "#1f6f54",
    color: "#15563f",
  },
  resetButton: {
    width: "100%",
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    borderRadius: "14px",
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  content: {
    display: "grid",
    gap: "18px",
  },
  resultsBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  resultsLeft: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  resultsText: {
    fontSize: "14px",
    color: "#374151",
    fontWeight: 600,
  },
  activeChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 10px",
    borderRadius: "999px",
    background: "#f3f4f6",
    color: "#374151",
    fontSize: "13px",
    fontWeight: 600,
  },
  emptyState: {
    borderRadius: "22px",
    background: "#ffffff",
    border: "1px dashed #d1d5db",
    padding: "30px",
    textAlign: "center",
  },
  emptyTitle: {
    marginTop: 0,
    marginBottom: "8px",
    color: "#111827",
  },
  emptyText: {
    margin: 0,
    color: "#6b7280",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: "18px",
  },
  card: {
    background: "#ffffff",
    borderRadius: "24px",
    overflow: "hidden",
    border: "1px solid #ececec",
    boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
  },
  imageWrap: {
    background: "#f8f5ef",
  },
  imageFallback: {
    minHeight: "280px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#6b7280",
    fontWeight: 600,
  },
  cardBody: {
    padding: "18px",
    display: "grid",
    gap: "16px",
  },
  cardTitle: {
    margin: 0,
    color: "#111827",
    fontSize: "22px",
    lineHeight: 1.2,
  },
  attributeBlock: {
    display: "grid",
    gap: "10px",
  },
  attributeSection: {
    display: "grid",
    gap: "6px",
  },
  attributeLabel: {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#6b7280",
  },
  inlineChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  inlineChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "7px 10px",
    borderRadius: "999px",
    background: "#f3f4f6",
    color: "#374151",
    fontSize: "13px",
    fontWeight: 600,
  },
  colorDot: {
    width: "12px",
    height: "12px",
    borderRadius: "999px",
    border: "1px solid rgba(15, 23, 42, 0.12)",
    flexShrink: 0,
  },
  metaList: {
    display: "grid",
    gap: "12px",
  },
  metaItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    paddingBottom: "10px",
    borderBottom: "1px solid #f0f0f0",
  },
  metaLabel: {
    color: "#6b7280",
    fontSize: "13px",
    minWidth: "110px",
  },
  metaValue: {
    color: "#111827",
    fontSize: "14px",
    textAlign: "right",
  },
  personLink: {
    background: "none",
    border: "none",
    color: "#2F7D57",
    cursor: "pointer",
    textDecoration: "underline",
    padding: 0,
    font: "inherit",
  },
  noteBlock: {
    borderRadius: "18px",
    background: "#faf7f2",
    border: "1px solid #efe7dc",
    padding: "14px",
  },
  noteTitle: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#6b7280",
    marginBottom: "8px",
  },
  noteText: {
    color: "#374151",
    lineHeight: 1.6,
    fontSize: "14px",
  },
};
