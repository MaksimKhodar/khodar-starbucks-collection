import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatDateTime, normalizeIso2 } from "../lib/utils";
import { uploadImagesForMug } from "../lib/mugImages";
import MugImagesManager from "./MugImagesManager";
import PersonSelect from "./PersonSelect";
import ConfirmModal from "./ConfirmModal";
import TypeSelect from "./TypeSelect";
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

// ─── helpers ──────────────────────────────────────────────────────────────────

const emptyForm = {
  id: null,
  collection_number: "",
  slug: "",
  title: "",
  country_id: "",
  state_id: "",
  city_id: "",
  city: "",
  city_key: "",
  type_values: [],
  received_at: "",
  brought_by: "",
  brought_by_person_ids: [],
  color_keys: [],
  note: "",
  is_published: true,
};

function normalizeCityName(v) {
  return String(v || "").trim().toLowerCase();
}

function slugify(v) {
  return String(v || "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9а-яё\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeSlug(v) {
  return slugify(String(v || ""));
}

function buildCollectionSlug(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return "";
  return `mug-${String(Math.trunc(num)).padStart(4, "0")}`;
}

function isUniqueViolation(e) {
  const msg = String(e?.message || "").toLowerCase();
  return e?.code === "23505" || e?.status === 409 || msg.includes("duplicate key");
}

function isSlugConflict(e) {
  return isUniqueViolation(e) &&
    [e?.code, e?.message, e?.details, e?.hint].filter(Boolean).join(" ").toLowerCase().includes("slug");
}

function isCollectionNumberConflict(e) {
  return isUniqueViolation(e) &&
    [e?.code, e?.message, e?.details, e?.hint].filter(Boolean).join(" ").toLowerCase().includes("collection_number");
}

function formatSaveError(e) {
  if (isCollectionNumberConflict(e)) return "Такой номер коллекции уже занят. Укажите другой.";
  if (isSlugConflict(e)) return "Технический slug уже занят.";
  if (isUniqueViolation(e)) return `Конфликт данных: ${e?.message || "проверьте поля."}`;
  return e?.message || "Не удалось сохранить кружку.";
}

function getCountryName(c, lang = "ru") {
  if (!c) return "—";
  return lang === "en"
    ? (c.name_en || c.name_ru || c.iso2_code || "—")
    : (c.name_ru || c.name_en || c.iso2_code || "—");
}

function getStateName(s, lang = "ru") {
  if (!s) return "";
  return lang === "en"
    ? (s.name_en || s.name_ru || s.code || "")
    : (s.name_ru || s.name_en || s.code || "");
}

function getCityName(city, lang = "ru", fallback = "") {
  if (!city) return fallback || "";
  return lang === "en"
    ? (city.name_en || city.name_ru || fallback || "")
    : (city.name_ru || city.name_en || fallback || "");
}

function buildLegacyCityOption(cityName, countryIso = "", countryId = "", stateId = "") {
  const trimmed = String(cityName || "").trim();
  const normalizedKey = slugify(trimmed) || "city";
  return {
    key: `legacy-${countryId || countryIso || "xx"}-${stateId || "na"}-${normalizedKey}`,
    countryIso,
    countryId: String(countryId || ""),
    stateId: String(stateId || ""),
    label: { ru: trimmed, en: trimmed },
    legacy: true,
  };
}

function mapDbCityToOption(cityRow, countryIso = "") {
  return {
    id: cityRow.id,
    key: cityRow.key || `city-${cityRow.id}`,
    countryId: String(cityRow.country_id || ""),
    stateId: String(cityRow.state_id || ""),
    countryIso,
    label: {
      ru: cityRow.name_ru || cityRow.name_en || cityRow.key || "",
      en: cityRow.name_en || cityRow.name_ru || cityRow.key || "",
    },
    lat: cityRow.latitude ?? null,
    lng: cityRow.longitude ?? null,
  };
}

function mergeCityOptions(primary = [], legacyValues = [], countryIso = "", countryId = "", stateId = "") {
  // Deduplicate primary options themselves first (db may have dupes)
  const seenPrimary = new Set();
  const dedupedPrimary = primary.filter(o => {
    const norm = normalizeCityName(o.label?.en || o.label?.ru || o.key);
    if (!norm || seenPrimary.has(norm)) return false;
    seenPrimary.add(norm);
    return true;
  });

  const seen = new Set(dedupedPrimary.map(o => normalizeCityName(o.label?.en || o.label?.ru || o.key)));
  const legacyOpts = ensureArray(legacyValues)
    .map(name => buildLegacyCityOption(name, countryIso, countryId, stateId))
    .filter(o => {
      const norm = normalizeCityName(o.label?.en || o.label?.ru || o.key);
      if (!norm || seen.has(norm)) return false;
      seen.add(norm);
      return true;
    });
  return [...dedupedPrimary, ...legacyOpts].sort((a, b) =>
    getLocalizedOptionLabel(a, "en").localeCompare(getLocalizedOptionLabel(b, "en"), "en")
  );
}

// ─── Color swatches ───────────────────────────────────────────────────────────

const COLOR_SWATCHES = {
  green: "#4CAF50", blue: "#2196F3", red: "#F44336", yellow: "#FFC107",
  orange: "#FF9800", brown: "#795548", black: "#212121", white: "#F5F5F5",
  gray: "#9E9E9E", grey: "#9E9E9E", purple: "#9C27B0", pink: "#E91E63",
  gold: "#FFD700", silver: "#C0C0C0", beige: "#D4B896", turquoise: "#00BCD4",
  multicolor: "#ccc", navy: "#1a237e",
};

// ─── Drawer ───────────────────────────────────────────────────────────────────

function Drawer({ isOpen, onClose, title, children }) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.35)",
          zIndex: 200, backdropFilter: "blur(2px)",
        }}
      />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(640px, 100vw)",
        background: "#fff", zIndex: 201,
        display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 40px rgba(0,0,0,0.15)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 24px", borderBottom: "1px solid #e8e2d9", flexShrink: 0,
        }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: "#153126" }}>{title}</span>
          <button
            type="button" onClick={onClose}
            style={{
              background: "none", border: "none", fontSize: 22,
              color: "#9ca3af", cursor: "pointer", padding: "4px 8px", lineHeight: 1,
            }}
          >✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 40px" }}>
          {children}
        </div>
      </div>
    </>
  );
}

// ─── SectionDivider ───────────────────────────────────────────────────────────

function SectionDivider({ title }) {
  return (
    <div style={{
      gridColumn: "1 / -1",
      display: "flex", alignItems: "center", gap: 10,
      margin: "12px 0 0",
    }}>
      <span style={{
        fontSize: 11, fontWeight: 800, color: "#1f6f54",
        textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap",
      }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: "#e2ddd4" }} />
    </div>
  );
}

// ─── ColorChips ───────────────────────────────────────────────────────────────

function ColorChips({ options = [], values = [], onToggle, language = "ru" }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map(option => {
        const active = values.includes(option.key);
        const swatch = COLOR_SWATCHES[option.key];
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onToggle(option.key)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "7px 13px", borderRadius: 999,
              border: active ? "2px solid #1f6f54" : "1.5px solid #d1d5db",
              background: active ? "#ecf7f1" : "#fff",
              color: active ? "#15563f" : "#374151",
              cursor: "pointer", fontSize: 13, fontWeight: 600,
              transition: "all 0.15s",
            }}
          >
            {swatch && (
              <span style={{
                width: 13, height: 13, borderRadius: "50%", flexShrink: 0,
                background: swatch,
                border: option.key === "white" ? "1px solid #ccc" : "none",
              }} />
            )}
            {getLocalizedOptionLabel(option, language)}
          </button>
        );
      })}
    </div>
  );
}

// ─── MugsAdmin ────────────────────────────────────────────────────────────────

function MugsAdmin({ onChanged, language = "ru", initialEditMugId = null, onEmbeddedClose = null }) {
  const [mugs, setMugs] = useState([]);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [citiesError, setCitiesError] = useState("");
  const [statesError, setStatesError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [numberFilter, setNumberFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [sortBy, setSortBy] = useState("collection-desc");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [initialForm, setInitialForm] = useState(emptyForm);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
  const [pendingImageFiles, setPendingImageFiles] = useState([]);
  const [isCityCreatorOpen, setIsCityCreatorOpen] = useState(false);
  const [newCityName, setNewCityName] = useState("");
  const [isCreatingCity, setIsCreatingCity] = useState(false);
  const [cityCreateError, setCityCreateError] = useState("");
  const [localCityOptions, setLocalCityOptions] = useState([]);

  const locale = language === "en" ? "en" : "ru";

  // ── Load ──────────────────────────────────────────────────────────────────

  async function loadAll() {
    setLoading(true);
    setError("");
    const [countriesRes, mugsRes, citiesRes, statesRes] = await Promise.all([
      supabase.from("countries")
        .select("id, iso2_code, name_en, name_ru")
        .order("name_en", { ascending: true }),
      supabase.from("mugs").select(`
        id, collection_number, country_id, state_id, city_id, slug, title,
        city, city_key, mug_type, received_at, brought_by,
        brought_by_person_ids, brought_by_person_id,
        color_keys, collection_keys, note, is_published,
        created_at, updated_at,
        country:countries (id, iso2_code, name_en, name_ru)
      `).order("collection_number", { ascending: false, nullsFirst: false }),
      supabase.from("cities")
        .select("id, key, country_id, state_id, name_en, name_ru, latitude, longitude, is_active, country_iso2, state_code")
        .eq("is_active", true)
        .order("name_en", { ascending: true })
        .limit(10000),
      supabase.from("states")
        .select("id, country_id, code, name_en, name_ru, is_active")
        .eq("is_active", true)
        .order("name_en", { ascending: true }),
    ]);

    if (countriesRes.error) { setError(countriesRes.error.message); setLoading(false); return; }
    if (mugsRes.error) { setError(mugsRes.error.message); setLoading(false); return; }

    setCountries(countriesRes.data ?? []);
    setMugs(mugsRes.data ?? []);
    setCities(citiesRes.error ? [] : citiesRes.data ?? []);
    setStates(statesRes.error ? [] : statesRes.data ?? []);
    setCitiesError(citiesRes.error ? "Не удалось загрузить города." : "");
    setStatesError(statesRes.error ? "Не удалось загрузить штаты/регионы." : "");
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  // Open edit form when initialEditMugId provided (from CatalogPage)
  useEffect(() => {
    if (!initialEditMugId || !mugs.length || !openEditForm) return;
    const mug = mugs.find(m => String(m.id) === String(initialEditMugId));
    if (mug) openEditForm(mug);
  }, [initialEditMugId, mugs]);

  // ── Maps ──────────────────────────────────────────────────────────────────

  const countriesById = useMemo(() => {
    const m = new Map();
    countries.forEach(c => m.set(String(c.id), c));
    return m;
  }, [countries]);

  const statesById = useMemo(() => {
    const m = new Map();
    states.forEach(s => m.set(String(s.id), s));
    return m;
  }, [states]);

  const citiesById = useMemo(() => {
    const m = new Map();
    cities.forEach(c => m.set(String(c.id), c));
    return m;
  }, [cities]);

  const nextCollectionNumber = useMemo(() => {
    const max = mugs.reduce((m, mug) => {
      const v = Number(mug.collection_number);
      return Number.isFinite(v) && v > m ? v : m;
    }, 0);
    return max + 1;
  }, [mugs]);

  const countryDisplayOptions = useMemo(() => {
    return countries
      .map(c => ({ value: String(c.id), label: getCountryName(c, language) }))
      .sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [countries, language, locale]);

  const resolveCountryIso = useCallback((countryId) => {
    return normalizeIso2(countriesById.get(String(countryId))?.iso2_code || "");
  }, [countriesById]);

  const stateOptionsByCountryId = useMemo(() => {
    const map = new Map();
    states.forEach(state => {
      const cid = String(state.country_id || "");
      if (!cid) return;
      const cur = map.get(cid) ?? [];
      cur.push({
        id: state.id,
        value: String(state.id),
        code: state.code || "",
        name_en: state.name_en || "",
        name_ru: state.name_ru || "",
        label: getStateName(state, language),
      });
      map.set(cid, cur);
    });
    map.forEach((opts, key) =>
      map.set(key, opts.sort((a, b) => a.label.localeCompare(b.label, locale)))
    );
    return map;
  }, [states, language, locale]);

  const currentStateOptions = useMemo(() => {
    if (!form.country_id) return [];
    return stateOptionsByCountryId.get(String(form.country_id)) ?? [];
  }, [form.country_id, stateOptionsByCountryId]);

  const currentCountryHasStates = currentStateOptions.length > 0;
  const currentCountryIso = resolveCountryIso(form.country_id);

  const currentCountryLegacyCities = useMemo(() => {
    const seen = new Set();
    return mugs
      .filter(m => String(m.country_id) === String(form.country_id || ""))
      .filter(m => !form.state_id || String(m.state_id || "") === String(form.state_id || ""))
      .map(m => {
        // Prefer localized name from cities table
        if (m.city_id) {
          const cityRecord = citiesById.get(String(m.city_id));
          if (cityRecord) {
            return language === "en"
              ? (cityRecord.name_en || cityRecord.name_ru || m.city || "")
              : (cityRecord.name_ru || cityRecord.name_en || m.city || "");
          }
        }
        return m.city || "";
      })
      .filter(Boolean)
      .filter(city => {
        const norm = normalizeCityName(city);
        if (seen.has(norm)) return false;
        seen.add(norm);
        return true;
      });
  }, [mugs, form.country_id, form.state_id, citiesById, language]);

  const getAvailableCityOptions = useCallback((countryId, stateId = "", legacyValues = []) => {
    const cid = String(countryId || "");
    const sid = String(stateId || "");
    const iso = resolveCountryIso(cid);

    // All cities for this country (and state if selected)
    const dbOpts = cities
      .filter(c => String(c.country_id || "") === cid)
      .filter(c => sid ? String(c.state_id || "") === sid : true)
      .map(c => mapDbCityToOption(c, iso));


    const localOpts = localCityOptions.filter(c =>
      c.countryId === cid && (sid ? String(c.stateId || "") === sid : true)
    );

    // Count how many mugs each city has
    const mugCountByCityId = new Map();
    mugs.forEach(m => {
      if (m.country_id && String(m.country_id) === cid) {
        const key = String(m.city_id || "");
        if (key) mugCountByCityId.set(key, (mugCountByCityId.get(key) || 0) + 1);
      }
    });

    const allOpts = mergeCityOptions([...dbOpts, ...localOpts], legacyValues, iso, cid, sid);

    // Sort: top 5 by mug count first (pinned), rest alphabetically
    const withCount = allOpts.map(o => ({
      ...o,
      _mugCount: mugCountByCityId.get(String(o.id || "")) || 0,
    }));

    const popular = withCount
      .filter(o => o._mugCount > 0)
      .sort((a, b) => b._mugCount - a._mugCount)
      .slice(0, 5);

    const popularIds = new Set(popular.map(o => o.key));

    const rest = withCount
      .filter(o => !popularIds.has(o.key))
      .sort((a, b) => getLocalizedOptionLabel(a, language).localeCompare(getLocalizedOptionLabel(b, language)));

    return [...popular, ...rest];
  }, [cities, localCityOptions, resolveCountryIso, mugs, language]);

  const currentCityOptions = useMemo(() => {
    if (!form.country_id) return [];
    if (currentCountryHasStates && !form.state_id) return [];
    return getAvailableCityOptions(form.country_id, form.state_id, currentCountryLegacyCities);
  }, [form.country_id, form.state_id, currentCountryHasStates, currentCountryLegacyCities, getAvailableCityOptions]);

  const hasDbCities = useMemo(() => {
    if (!form.country_id) return false;
    if (currentCountryHasStates && !form.state_id) return false;
    return currentCityOptions.length > 0;
  }, [form.country_id, form.state_id, currentCountryHasStates, currentCityOptions]);

  // ── Form ──────────────────────────────────────────────────────────────────

  function createFormState(mug = emptyForm) {
    const countryId = mug.country_id ? String(mug.country_id) : "";
    const stateId = mug.state_id ? String(mug.state_id) : "";
    const legacyCities = [...new Set(
      mugs
        .filter(m => String(m.country_id) === countryId)
        .filter(m => !stateId || String(m.state_id || "") === stateId)
        .map(m => {
          if (m.city_id) {
            const cityRecord = citiesById.get(String(m.city_id));
            if (cityRecord) {
              return language === "en"
                ? (cityRecord.name_en || cityRecord.name_ru || m.city || "")
                : (cityRecord.name_ru || cityRecord.name_en || m.city || "");
            }
          }
          return m.city || "";
        })
        .filter(Boolean)
        .map(c => c.trim())
    )].filter(Boolean);
    const availableCities = getAvailableCityOptions(countryId, stateId, legacyCities);
    const selectedCity = mug.city_id ? citiesById.get(String(mug.city_id)) : null;
    const cityKey = selectedCity?.key || mug.city_key ||
      availableCities.find(o => o.label.en === mug.city || o.label.ru === mug.city)?.key || "";
    const cityLabel = selectedCity
      ? getCityName(selectedCity, language, mug.city || "")
      : getCityDisplayName(cityKey, mug.city || "", language) || mug.city || "";

    return {
      id: mug.id || null,
      collection_number: mug.collection_number == null ? "" : String(mug.collection_number),
      slug: mug.slug || "",
      title: mug.title || "",
      country_id: countryId,
      state_id: stateId,
      city_id: mug.city_id ? String(mug.city_id) : "",
      city: cityLabel,
      city_key: cityKey,
      type_values: getTypeValues(mug.collection_keys, mug.mug_type),
      received_at: mug.received_at || "",
      brought_by: mug.brought_by || "",
      brought_by_person_ids: ensureArray(mug.brought_by_person_ids || mug.brought_by_person_id),
      color_keys: ensureArray(mug.color_keys),
      note: mug.note || "",
      is_published: mug.is_published == null ? true : !!mug.is_published,
    };
  }

  function openCreateForm() {
    const f = {
      ...emptyForm,
      collection_number: String(nextCollectionNumber),
      slug: buildCollectionSlug(nextCollectionNumber),
    };
    setForm(f); setInitialForm(f); setPendingImageFiles([]); setIsFormOpen(true); setError("");
  }

  function openEditForm(mug) {
    const f = createFormState(mug);
    setForm(f); setInitialForm(f); setPendingImageFiles([]); setIsFormOpen(true); setError("");
  }

  function hasFormChanged() {
    return JSON.stringify(form) !== JSON.stringify(initialForm) || pendingImageFiles.length > 0;
  }

  function closeFormImmediately() {
    setForm(emptyForm); setInitialForm(emptyForm); setPendingImageFiles([]);
    setIsFormOpen(false); setIsDiscardModalOpen(false); setError("");
    setIsCityCreatorOpen(false); setNewCityName(""); setCityCreateError("");
    if (onEmbeddedClose) onEmbeddedClose();
  }

  function requestCloseForm() {
    if (!hasFormChanged()) { closeFormImmediately(); return; }
    setIsDiscardModalOpen(true);
  }

  function updateForm(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function updateCollectionNumber(value) {
    const v = String(value || "").replace(/[^\d]/g, "");
    setForm(prev => ({ ...prev, collection_number: v, slug: buildCollectionSlug(v) || prev.slug }));
  }

  function updateCountry(value) {
    const nextStateOpts = stateOptionsByCountryId.get(String(value)) ?? [];
    const hasStates = nextStateOpts.length > 0;
    const nextStateId = hasStates && nextStateOpts.some(o => o.value === String(form.state_id || ""))
      ? String(form.state_id || "") : "";
    setForm(prev => ({ ...prev, country_id: value, state_id: nextStateId, city_id: "", city_key: "", city: "" }));
  }

  function updateState(value) {
    setForm(prev => ({ ...prev, state_id: value, city_id: "", city_key: "", city: "" }));
  }

  function updateCity(selectedValue) {
    const selectedCity = currentCityOptions.find(
      o => o.key === selectedValue || String(o.id) === String(selectedValue)
    );
    setForm(prev => ({
      ...prev,
      // FIX: city_id — UUID, не оборачивать в Number()
      city_id: selectedCity?.id ? String(selectedCity.id) : "",
      city_key: selectedCity?.key || selectedValue || "",
      city: selectedCity
        ? getLocalizedOptionLabel(selectedCity, language) || selectedCity.label.en || selectedCity.label.ru || ""
        : "",
    }));
  }

  function toggleMultiValue(field, key) {
    setForm(prev => {
      const cur = ensureArray(prev[field]);
      return { ...prev, [field]: cur.includes(key) ? cur.filter(v => v !== key) : [...cur, key] };
    });
  }

  // ── City creation ─────────────────────────────────────────────────────────

  function closeCityCreator() {
    setIsCityCreatorOpen(false); setNewCityName(""); setCityCreateError("");
  }

  async function createCity() {
    if (!form.country_id) { setCityCreateError("Выберите страну."); return; }
    if (currentCountryHasStates && !form.state_id) { setCityCreateError("Выберите штат."); return; }
    if (!newCityName.trim()) { setCityCreateError("Введите название города."); return; }

    setIsCreatingCity(true); setCityCreateError("");

    const citySlug = slugify(newCityName.trim());
    const cityKey = [currentCountryIso || "xx", form.state_id || "na", citySlug || "city"].filter(Boolean).join("-");
    const payload = {
      country_id: form.country_id,
      state_id: form.state_id || null,
      name_en: newCityName.trim(),
      name_ru: newCityName.trim(),
      latitude: null, longitude: null, is_active: true,
      country_iso2: currentCountryIso || null,
      state_code: form.state_id ? (states.find(s => String(s.id) === String(form.state_id))?.code || null) : null,
    };

    const { data: cityData, error: cityError } = await supabase
      .from("cities").insert(payload)
      .select("id, key, country_id, state_id, name_en, name_ru").single();

    if (cityError) {
      const isUnauth = cityError.status === 401 || cityError.status === 403 ||
        String(cityError.message || "").toLowerCase().includes("unauthorized");
      if (isUnauth) {
        const fallback = {
          id: null, key: cityKey,
          countryId: String(form.country_id),
          stateId: String(form.state_id || ""),
          label: { ru: newCityName.trim(), en: newCityName.trim() },
        };
        setLocalCityOptions(prev => prev.find(i => i.key === cityKey) ? prev : [...prev, fallback]);
        setForm(prev => ({ ...prev, city_id: "", city_key: cityKey, city: newCityName.trim() }));
        closeCityCreator(); setIsCreatingCity(false); return;
      }
      if (cityError.code === "23505") {
        let q = supabase.from("cities")
          .select("id, key, country_id, state_id, name_en, name_ru")
          .eq("key", cityKey).eq("country_id", form.country_id);
        q = form.state_id ? q.eq("state_id", Number(form.state_id)) : q.is("state_id", null);
        const { data: existing } = await q.single();
        if (existing) {
          await loadAll();
          setForm(prev => ({
            ...prev,
            city_id: String(existing.id),
            city_key: existing.key,
            city: getCityName(existing, language, newCityName.trim()),
          }));
          closeCityCreator(); setIsCreatingCity(false); return;
        }
      }
      setCityCreateError(cityError.message || "Не удалось добавить город.");
      setIsCreatingCity(false); return;
    }

    await loadAll();
    setForm(prev => ({
      ...prev,
      city_id: cityData.id ? String(cityData.id) : "",
      city_key: cityData.key || cityKey,
      city: getCityName(cityData, language, newCityName.trim()),
    }));
    closeCityCreator(); setIsCreatingCity(false);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  function buildAvailableSlug(base, excludeId = null, reserved = new Set()) {
    const norm = normalizeSlug(base) || `mug-${Date.now()}`;
    const taken = new Set(reserved);
    mugs.forEach(m => {
      if (String(m.id) !== String(excludeId || "")) {
        const s = normalizeSlug(m.slug);
        if (s) taken.add(s);
      }
    });
    if (!taken.has(norm)) return norm;
    let suffix = 2, candidate = `${norm}-${suffix}`;
    while (taken.has(candidate)) { suffix++; candidate = `${norm}-${suffix}`; }
    return candidate;
  }

  async function persistMug(payload, nowIso) {
    const reserved = new Set();
    let lastError = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const slug = buildAvailableSlug(payload.slug, form.id, reserved);
      const p = { ...payload, slug };
      const result = form.id
        ? await supabase.from("mugs").update(p).eq("id", form.id)
        : await supabase.from("mugs").insert({ ...p, created_at: nowIso }).select("id, slug").single();
      if (!result.error) return { result, savedPayload: p };
      lastError = result.error;
      if (!isSlugConflict(result.error)) throw result.error;
      reserved.add(slug);
    }
    throw lastError || new Error("Не удалось подобрать свободный slug.");
  }

  async function saveForm(event) {
    event.preventDefault();

    if (!form.title.trim()) { setError("Укажите название кружки."); return; }

    const collectionNumber = Number(form.collection_number);
    if (!Number.isFinite(collectionNumber) || collectionNumber <= 0 || !Number.isInteger(collectionNumber)) {
      setError("Укажите корректный № коллекции — целое положительное число."); return;
    }

    const numberTaken = mugs.some(m =>
      String(m.id) !== String(form.id || "") && Number(m.collection_number) === collectionNumber
    );
    if (numberTaken) { setError(`Номер ${collectionNumber} уже занят другой кружкой.`); return; }
    if (!form.country_id) { setError("Выберите страну."); return; }

    const selectedStateOption = currentStateOptions.find(o => o.value === String(form.state_id || ""));
    const selectedCityOption = currentCityOptions.find(
      o => o.key === form.city_key || String(o.id) === String(form.city_id)
    ) || null;
    // Use localized city label — prefer ru for ru language, en for en
    const cityLabel = selectedCityOption
      ? (language === "en"
          ? selectedCityOption.label.en || selectedCityOption.label.ru || ""
          : selectedCityOption.label.ru || selectedCityOption.label.en || "")
      : form.city.trim();

    setSaving(true); setError("");
    const nowIso = new Date().toISOString();
    const collectionSlug = buildCollectionSlug(collectionNumber);
    const baseSlug = normalizeSlug(collectionSlug) || normalizeSlug(form.slug) ||
      slugify([form.title, selectedStateOption?.name_en || "", cityLabel].filter(Boolean).join(" ")) ||
      `mug-${Date.now()}`;

    const typeLabels = getTypeLabels(form.type_values, "ru");

    const payload = {
      collection_number: collectionNumber,
      slug: baseSlug,
      title: form.title.trim(),
      country_id: Number(form.country_id),
      // FIX: fill country_iso2 and state_code
      country_iso2: resolveCountryIso(form.country_id) || null,
      state_id: selectedStateOption?.id ? Number(selectedStateOption.id) : null,
      state_code: selectedStateOption?.code || null,
      // FIX: city_id is UUID — store as string, NOT Number()
      city_id: selectedCityOption?.id ? String(selectedCityOption.id) : null,
      city_key: selectedCityOption?.key || null,
      city: cityLabel || null,
      mug_type: typeLabels.join(", ") || null,
      received_at: form.received_at || null,
      brought_by: form.brought_by.trim() || null,
      brought_by_person_ids: ensureArray(form.brought_by_person_ids),
      brought_by_person_id: ensureArray(form.brought_by_person_ids)[0] || null,
      color_keys: ensureArray(form.color_keys),
      collection_keys: ensureArray(form.type_values),
      note: form.note.trim() || null,
      is_published: !!form.is_published,
      updated_at: nowIso,
    };

    // Auto-fill brought_by from people records
    if (!payload.brought_by && payload.brought_by_person_ids.length > 0) {
      const { data: peopleData } = await supabase
        .from("people").select("first_name, last_name")
        .in("id", payload.brought_by_person_ids);
      if (Array.isArray(peopleData) && peopleData.length > 0) {
        payload.brought_by = peopleData.map(p => `${p.first_name} ${p.last_name}`).join(", ");
      }
    }

    let result, savedMugId = form.id || "", savedPayload = payload;
    try {
      const persisted = await persistMug(payload, nowIso);
      result = persisted.result; savedPayload = persisted.savedPayload;
    } catch (saveError) {
      setError(formatSaveError(saveError)); setSaving(false); return;
    }

    if (result.error) { setError(formatSaveError(result.error)); setSaving(false); return; }
    if (!form.id) savedMugId = result.data?.id || "";

    if (savedMugId && pendingImageFiles.length > 0) {
      try {
        await uploadImagesForMug(savedMugId, pendingImageFiles, 0);
        setPendingImageFiles([]);
      } catch (uploadError) {
        await loadAll(); await onChanged?.();
        if (savedMugId) {
          const nextF = {
            ...form, id: savedMugId,
            collection_number: String(savedPayload.collection_number || ""),
            slug: savedPayload.slug,
          };
          setPendingImageFiles([]); setForm(nextF); setInitialForm(nextF);
        }
        setError(uploadError.message || "Кружка сохранена, но не удалось загрузить фото.");
        setSaving(false); return;
      }
    }

    await loadAll(); await onChanged?.();
    closeFormImmediately(); setSaving(false);
  }

  async function deleteMug(mugId) {
    if (!window.confirm("Удалить эту кружку?")) return;
    setError("");
    const { error: err } = await supabase.from("mugs").delete().eq("id", mugId);
    if (err) { setError(err.message); return; }
    await loadAll(); await onChanged?.();
  }

  // ── Prepared mugs ─────────────────────────────────────────────────────────

  const preparedMugs = useMemo(() => {
    return mugs.map(mug => {
      const country = countriesById.get(String(mug.country_id || ""));
      const countryIso = resolveCountryIso(mug.country_id);
      const stateEntity = statesById.get(String(mug.state_id || ""));
      const cityEntity = citiesById.get(String(mug.city_id || ""));
      const stateLabel = stateEntity ? getStateName(stateEntity, language) : "";
      const cityLabel = cityEntity
        ? getCityName(cityEntity, language, mug.city || "")
        : getCityDisplayName(mug.city_key, mug.city, language) || mug.city || "";
      const cityFilterValue = cityEntity
        ? cityEntity.key
        : buildCityFilterValue(mug.city_key, mug.city, countryIso);
      const colorLabels = getColorLabels(mug.color_keys, language);
      const typeValues = getTypeValues(mug.collection_keys, mug.mug_type);
      const typeLabels = getTypeLabels(typeValues, language);
      return {
        ...mug, countryEntity: country, countryIso,
        countryLabel: getCountryName(mug.country, language) || getCountryName(country, language),
        stateLabel, cityLabel, cityFilterValue, colorLabels, typeValues, typeLabels,
      };
    });
  }, [mugs, resolveCountryIso, statesById, citiesById, countriesById, language]);

  const typeOptions = useMemo(() => {
    const existing = preparedMugs.flatMap(m => m.typeValues || []);
    return buildTypeOptions({ selectedValues: form.type_values, existingValues: existing, language });
  }, [preparedMugs, form.type_values, language]);

  const cityFilterOptions = useMemo(() => {
    const map = new Map();
    preparedMugs.forEach(mug => {
      if (!mug.cityLabel) return;
      const key = mug.cityFilterValue;
      if (!map.has(key)) {
        map.set(key, {
          value: key,
          label: mug.stateLabel ? `${mug.cityLabel} (${mug.stateLabel})` : mug.cityLabel,
          count: 0,
        });
      }
      map.get(key).count += 1;
    });
    return [...map.values()]
      .sort((a, b) => a.label.localeCompare(b.label, locale))
      .map(o => ({ ...o, displayLabel: `${o.label} (${o.count})` }));
  }, [preparedMugs, locale]);

  const countryFilterOptions = useMemo(() => {
    const map = new Map();
    preparedMugs.forEach(mug => {
      if (!mug.countryLabel || !mug.country_id) return;
      const key = String(mug.country_id);
      if (!map.has(key)) {
        map.set(key, { value: key, label: mug.countryLabel, count: 0 });
      }
      map.get(key).count += 1;
    });
    return [...map.values()]
      .sort((a, b) => a.label.localeCompare(b.label, locale))
      .map(o => ({ ...o, displayLabel: `${o.label} (${o.count})` }));
  }, [preparedMugs, locale]);

  const filteredMugs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const numQ = numberFilter.trim();
    return preparedMugs
      .filter(mug => {
        // Exact match by collection number
        if (numQ && String(mug.collection_number || "") !== numQ) return false;
        if (countryFilter && String(mug.country_id || "") !== String(countryFilter)) return false;
        if (cityFilter && mug.cityFilterValue !== cityFilter) return false;
        if (q) {
          const text = [
            mug.title, mug.slug, mug.collection_number, mug.stateLabel,
            mug.cityLabel, mug.brought_by, mug.mug_type,
            mug.country?.name_en, mug.country?.name_ru, mug.countryLabel,
            ...mug.colorLabels, ...mug.typeLabels,
          ].filter(Boolean).join(" ").toLowerCase();
          if (!text.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const an = Number(a.collection_number || 0), bn = Number(b.collection_number || 0);
        if (sortBy === "collection-asc") return an - bn;
        if (sortBy === "country-asc") return String(a.countryLabel || "").localeCompare(String(b.countryLabel || ""), locale);
        if (sortBy === "created-desc") return String(b.created_at || "").localeCompare(String(a.created_at || ""));
        if (sortBy === "updated-desc") return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
        return bn - an;
      });
  }, [preparedMugs, search, numberFilter, countryFilter, cityFilter, sortBy, locale]);

  const activeFilters = [numberFilter, countryFilter, cityFilter].filter(Boolean).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="card admin-card">

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="admin-toolbar">
        <div>
          <div className="section-title">Администрирование кружек</div>
          <p className="admin-subtitle">
            Здесь можно добавлять, редактировать и удалять кружки, управлять цветами, типами и городами.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 240px" }}>
            <span style={{
              position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
              color: "#8a9e96", pointerEvents: "none",
            }}>🔍</span>
            <input
              className="admin-search"
              type="text"
              placeholder="Поиск по названию, стране, городу, цвету..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>

          <input
            className="admin-search"
            type="number"
            min="1"
            placeholder="№ кружки"
            value={numberFilter}
            onChange={e => setNumberFilter(e.target.value.replace(/[^\d]/g, ""))}
            style={{ width: 100, flex: "0 0 auto" }}
            title="Точный поиск по номеру коллекции"
          />

          <button
            type="button"
            onClick={() => setFiltersOpen(p => !p)}
            className="secondary-button"
            style={{
              background: filtersOpen ? "#153126" : undefined,
              color: filtersOpen ? "#fff" : undefined,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            ⚙ Фильтры
            {activeFilters > 0 && (
              <span style={{
                background: "#1f6f54", color: "#fff",
                borderRadius: 999, padding: "1px 7px", fontSize: 11, fontWeight: 700,
              }}>{activeFilters}</span>
            )}
          </button>

          <select
            className="admin-search"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{ flex: "0 0 auto" }}
          >
            <option value="collection-desc">№: новые сверху</option>
            <option value="collection-asc">№: старые сверху</option>
            <option value="country-asc">Страна А→Я</option>
            <option value="created-desc">Недавно добавленные</option>
            <option value="updated-desc">Недавно изменённые</option>
          </select>

          <button className="secondary-button" onClick={loadAll} type="button" disabled={saving}>
            Обновить
          </button>
          <button className="primary-button" onClick={openCreateForm} type="button" disabled={isFormOpen}>
            + Добавить кружку
          </button>
        </div>

        {filtersOpen && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12, padding: 16,
            background: "#f8f4ed", borderRadius: 16,
            border: "1px solid #eadfce", marginTop: 4,
          }}>
            <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "#31443a" }}>
              Страна
              <select className="admin-search" value={countryFilter} onChange={e => { setCountryFilter(e.target.value); setCityFilter(""); }}>
                <option value="">Все страны</option>
                {countryFilterOptions.map(o => <option key={o.value} value={o.value}>{o.displayLabel}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "#31443a" }}>
              Город
              <select className="admin-search" value={cityFilter} onChange={e => setCityFilter(e.target.value)}>
                <option value="">Все города</option>
                {cityFilterOptions.map(o => <option key={o.value} value={o.value}>{o.displayLabel}</option>)}
              </select>
            </label>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                type="button" className="secondary-button"
                onClick={() => { setCountryFilter(""); setCityFilter(""); setNumberFilter(""); setSearch(""); }}
              >
                Сбросить все
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="empty-state"><h2>Загрузка…</h2></div>
      ) : error && !isFormOpen ? (
        <div className="empty-state"><h2>Ошибка</h2><p>{error}</p></div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Название</th>
                <th>Страна</th>
                <th>Штат</th>
                <th>Город</th>
                <th>Тип</th>
                <th>Цвета</th>
                <th>Дата получения</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredMugs.map(mug => (
                <tr key={mug.id}>
                  <td><strong>{mug.collection_number || "—"}</strong></td>
                  <td>
                    <div className="table-title">{mug.title}</div>
                    {mug.brought_by && <div className="table-subtitle">{mug.brought_by}</div>}
                  </td>
                  <td>{mug.countryLabel || "—"}</td>
                  <td>{mug.stateLabel || "—"}</td>
                  <td>{mug.cityLabel || "—"}</td>
                  <td>{mug.typeLabels.join(", ") || "—"}</td>
                  <td>{mug.colorLabels.join(", ") || "—"}</td>
                  <td>{mug.received_at || "—"}</td>
                  <td>
                    <span className={mug.is_published ? "status-badge status-badge-light" : "status-badge status-badge-gray"}>
                      {mug.is_published ? "published" : "draft"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="secondary-button"
                        onClick={() => openEditForm(mug)}
                        type="button" disabled={saving}
                      >Редактировать</button>
                      <button
                        className="danger-button"
                        onClick={() => deleteMug(mug.id)}
                        type="button" disabled={saving}
                      >Удалить</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMugs.length === 0 && (
            <div className="empty-inline">Ничего не найдено.</div>
          )}
        </div>
      )}

      {/* ── Drawer ──────────────────────────────────────────────────────── */}
      <Drawer
        isOpen={isFormOpen}
        onClose={requestCloseForm}
        title={form.id ? `Редактировать кружку #${form.collection_number}` : "Новая кружка"}
      >
        <form onSubmit={saveForm}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

            {/* ── Основное ── */}
            <SectionDivider title="Основное" />

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#31443a" }}>
                  Название <span style={{ color: "#dc2626" }}>*</span>
                </span>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => updateForm("title", e.target.value)}
                  placeholder="Например: Starbucks Warsaw"
                />
              </label>
            </div>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#31443a" }}>Дата получения</span>
              <input
                type="date"
                value={form.received_at}
                onChange={e => updateForm("received_at", e.target.value)}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#31443a" }}>
                № в коллекции <span style={{ color: "#dc2626" }}>*</span>
              </span>
              <input
                type="number" min="1" step="1"
                value={form.collection_number}
                onChange={e => updateCollectionNumber(e.target.value)}
                placeholder={`Например: ${nextCollectionNumber}`}
              />
              <span style={{ fontSize: 11, color: "#8a9e96" }}>
                Порядковый номер, совпадает с нумерацией в Instagram
              </span>
            </label>

            {/* ── Кто привёз ── */}
            <SectionDivider title="Кто привёз" />

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#31443a" }}>
                  Выбрать из справочника
                </span>
                <PersonSelect
                  value={form.brought_by_person_ids}
                  onChange={(personIds, persons) => {
                    updateForm("brought_by_person_ids", personIds || []);
                    if (Array.isArray(persons) && persons.length > 0) {
                      updateForm("brought_by", persons.map(p => `${p.first_name} ${p.last_name}`).join(", "));
                    }
                  }}
                />
              </label>
            </div>

            {/* Текстовое поле — только если человек не выбран из справочника */}
            {form.brought_by_person_ids.length === 0 && (
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#31443a" }}>
                    Или введите текстом
                  </span>
                  <input
                    type="text"
                    value={form.brought_by}
                    onChange={e => updateForm("brought_by", e.target.value)}
                    placeholder="Имя или @instagram"
                  />
                </label>
              </div>
            )}

            {/* ── География ── */}
            <SectionDivider title="География" />

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#31443a" }}>
                  Страна <span style={{ color: "#dc2626" }}>*</span>
                </span>
                <select value={form.country_id} onChange={e => updateCountry(e.target.value)}>
                  <option value="">Выберите страну</option>
                  {countryDisplayOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {currentCountryHasStates && (
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#31443a" }}>Штат / регион</span>
                <select value={form.state_id} onChange={e => updateState(e.target.value)}>
                  <option value="">Не выбран</option>
                  {currentStateOptions.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                {statesError && (
                  <span style={{ fontSize: 11, color: "#dc2626" }}>{statesError}</span>
                )}
              </label>
            )}

            <label style={{
              display: "grid", gap: 6,
              gridColumn: currentCountryHasStates ? "auto" : "1 / -1",
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#31443a" }}>Город</span>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value={form.city_key}
                  onChange={e => updateCity(e.target.value)}
                  disabled={!form.country_id || (currentCountryHasStates && !form.state_id)}
                  style={{ flex: 1 }}
                >
                  <option value="">
                    {!form.country_id
                      ? "Сначала выберите страну"
                      : currentCountryHasStates && !form.state_id
                        ? "Сначала выберите штат"
                        : "Не выбран"}
                  </option>
                  {(() => {
                    // Count popular cities (those with _mugCount > 0, top 5)
                    const popular = currentCityOptions.filter(c => c._mugCount > 0).slice(0, 5);
                    const rest = currentCityOptions.filter(c => !popular.includes(c));
                    if (popular.length === 0) {
                      return currentCityOptions.map(c => (
                        <option key={c.key} value={c.key}>
                          {getLocalizedOptionLabel(c, language)}
                        </option>
                      ));
                    }
                    return (
                      <>
                        <optgroup label="⭐ Популярные">
                          {popular.map(c => (
                            <option key={c.key} value={c.key}>
                              {getLocalizedOptionLabel(c, language)}
                            </option>
                          ))}
                        </optgroup>
                        {rest.length > 0 && (
                          <optgroup label="Все города">
                            {rest.map(c => (
                              <option key={c.key} value={c.key}>
                                {getLocalizedOptionLabel(c, language)}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    );
                  })()}
                </select>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!form.country_id || isCreatingCity || (currentCountryHasStates && !form.state_id)}
                  onClick={() => setIsCityCreatorOpen(true)}
                  style={{ minWidth: 36, padding: "0 10px" }}
                  title="Добавить город"
                >+</button>
              </div>
              {citiesError && <span style={{ fontSize: 11, color: "#dc2626" }}>{citiesError}</span>}
              {!hasDbCities && form.country_id && !(currentCountryHasStates && !form.state_id) && (
                <span style={{ fontSize: 11, color: "#8a9e96" }}>
                  Городов пока нет. Нажмите + чтобы добавить.
                </span>
              )}
            </label>

            {isCityCreatorOpen && (
              <div style={{
                gridColumn: "1 / -1",
                padding: "12px 14px", borderRadius: 12,
                background: "#f9f7f3", border: "1px solid #e2e8e3",
                display: "grid", gap: 8,
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#31443a" }}>Новый город</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    type="text"
                    value={newCityName}
                    onChange={e => setNewCityName(e.target.value)}
                    placeholder="Название города"
                    style={{ flex: 1 }}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); createCity(); } }}
                  />
                  <button type="button" className="primary-button" onClick={createCity} disabled={isCreatingCity}>
                    {isCreatingCity ? "Создаём…" : "Создать"}
                  </button>
                  <button type="button" className="secondary-button" onClick={closeCityCreator} disabled={isCreatingCity}>
                    Отмена
                  </button>
                </div>
                {cityCreateError && (
                  <span style={{ color: "#b91c1c", fontSize: 12 }}>{cityCreateError}</span>
                )}
              </div>
            )}

            {/* ── Характеристики ── */}
            <SectionDivider title="Характеристики" />

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#31443a" }}>Тип / коллекция</span>
                <TypeSelect
                  value={form.type_values}
                  options={typeOptions}
                  onChange={vals => updateForm("type_values", vals || [])}
                />
              </label>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#31443a", display: "block", marginBottom: 10 }}>
                Цвета
              </span>
              <ColorChips
                options={COLOR_OPTIONS}
                values={form.color_keys}
                onToggle={key => toggleMultiValue("color_keys", key)}
                language={language}
              />
            </div>

            {/* ── История и публикация ── */}
            <SectionDivider title="История и публикация" />

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#31443a" }}>История / заметка</span>
                <textarea
                  rows="4"
                  value={form.note}
                  onChange={e => updateForm("note", e.target.value)}
                  placeholder="Откуда кружка, интересная история, особенности..."
                />
              </label>
            </div>

            <label style={{
              display: "flex", alignItems: "center", gap: 10,
              cursor: "pointer", gridColumn: "1 / -1",
            }}>
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={e => updateForm("is_published", e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontSize: 14, color: "#1f2937" }}>
                Опубликовано (видно на сайте)
              </span>
            </label>

          </div>

          {/* Images */}
          <div style={{ marginTop: 20 }}>
            <MugImagesManager
              mugId={form.id}
              pendingFiles={pendingImageFiles}
              onPendingFilesChange={setPendingImageFiles}
              onChanged={async () => { await loadAll(); await onChanged?.(); }}
            />
          </div>

          {error && (
            <div style={{
              marginTop: 16, padding: "12px 14px", borderRadius: 12,
              background: "#fef2f2", border: "1px solid #fecaca",
              color: "#b91c1c", fontSize: 14,
            }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
            <button className="secondary-button" type="button" onClick={requestCloseForm} disabled={saving}>
              Отмена
            </button>
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Сохраняем…" : form.id ? "Сохранить" : "Создать кружку"}
            </button>
          </div>
        </form>
      </Drawer>

      <ConfirmModal
        isOpen={isDiscardModalOpen}
        title="Закрыть без сохранения?"
        message="Вы внесли изменения. Они будут потеряны если закрыть форму сейчас."
        confirmLabel="Закрыть без сохранения"
        cancelLabel="Продолжить редактирование"
        danger
        onCancel={() => setIsDiscardModalOpen(false)}
        onConfirm={closeFormImmediately}
      />
    </section>
  );
}

export default MugsAdmin;

// ── MugEditDrawer — use in CatalogPage for inline editing ──────────────────
export function MugEditDrawer({ mugId, onClose, onChanged, language = "ru" }) {
  if (!mugId) return null;
  return (
    <MugsAdmin
      onChanged={onChanged}
      language={language}
      initialEditMugId={mugId}
      onEmbeddedClose={onClose}
    />
  );
}
