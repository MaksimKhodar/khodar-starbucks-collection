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

const emptyForm = {
  id: null,
  slug: "",
  title: "",
  country_id: "",
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

function normalizeCityName(value) {
  return String(value || "").trim().toLowerCase();
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeSlug(value) {
  return slugify(String(value || ""));
}

function isUniqueViolation(error) {
  const message = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  const hint = String(error?.hint || "").toLowerCase();

  return (
    error?.code === "23505" ||
    error?.status === 409 ||
    message.includes("duplicate key") ||
    details.includes("already exists") ||
    hint.includes("already exists")
  );
}

function isSlugConflict(error) {
  const haystack = [
    error?.code,
    error?.message,
    error?.details,
    error?.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return isUniqueViolation(error) && haystack.includes("slug");
}

function formatSaveError(error) {
  if (isSlugConflict(error)) {
    return "Не удалось сохранить кружку: такой slug уже занят. Попробуйте изменить slug вручную.";
  }

  if (isUniqueViolation(error)) {
    return `Не удалось сохранить кружку из-за конфликта данных: ${error?.message || "проверьте уникальные поля и попробуйте снова."}`;
  }

  return error?.message || "Не удалось сохранить кружку.";
}

function buildLegacyCityOption(cityName, countryIso = "", countryId = "") {
  const trimmedName = String(cityName || "").trim();
  const normalizedKey = slugify(trimmedName) || "city";

  return {
    key: `legacy-${countryId || countryIso || "xx"}-${normalizedKey}`,
    countryIso,
    countryId: String(countryId || ""),
    label: {
      ru: trimmedName,
      en: trimmedName,
    },
    legacy: true,
  };
}

function mapDbCityToOption(cityRow, countryIso = "") {
  return {
    id: cityRow.id,
    key: cityRow.key || `city-${cityRow.id}`,
    countryId: String(cityRow.country_id || ""),
    countryIso,
    label: {
      ru: cityRow.name_ru || cityRow.name_en || cityRow.key || "",
      en: cityRow.name_en || cityRow.name_ru || cityRow.key || "",
    },
    lat: cityRow.latitude ?? null,
    lng: cityRow.longitude ?? null,
  };
}

function mergeCityOptions(primaryOptions = [], legacyValues = [], countryIso = "", countryId = "") {
  const seen = new Set(
    primaryOptions.map((option) => normalizeCityName(option.label?.en || option.label?.ru || option.key))
  );

  const legacyOptions = ensureArray(legacyValues)
    .map((cityName) => buildLegacyCityOption(cityName, countryIso, countryId))
    .filter((option) => {
      const normalizedLabel = normalizeCityName(option.label?.en || option.label?.ru || option.key);

      if (!normalizedLabel || seen.has(normalizedLabel)) {
        return false;
      }

      seen.add(normalizedLabel);
      return true;
    });

  return [...primaryOptions, ...legacyOptions].sort((a, b) => {
    return getLocalizedOptionLabel(a, "en").localeCompare(getLocalizedOptionLabel(b, "en"), "en");
  });
}

function renderSwatch(option) {
  if (!option?.swatch) return null;

  return (
    <span
      aria-hidden="true"
      style={{
        width: "12px",
        height: "12px",
        borderRadius: "999px",
        border: "1px solid rgba(15, 23, 42, 0.12)",
        background: option.swatch,
        flexShrink: 0,
      }}
    />
  );
}

function SelectableChipGroup({
  options = [],
  values = [],
  onToggle,
  emptyText,
  showSwatch = false,
  language = "ru",
}) {
  if (!options.length) {
    return (
      <div
        style={{
          padding: "12px 14px",
          borderRadius: "12px",
          border: "1px dashed #d1d5db",
          color: "#6b7280",
          fontSize: "14px",
          background: "#f9fafb",
        }}
      >
        {emptyText}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      {options.map((option) => {
        const active = values.includes(option.key);

        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onToggle(option.key)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 12px",
              borderRadius: "999px",
              border: active ? "1px solid #1f6f54" : "1px solid #d1d5db",
              background: active ? "#ecf7f1" : "#ffffff",
              color: active ? "#15563f" : "#374151",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            {showSwatch ? renderSwatch(option) : null}
            <span>{getLocalizedOptionLabel(option, language)}</span>
          </button>
        );
      })}
    </div>
  );
}

function MugsAdmin({ onChanged }) {
  const [mugs, setMugs] = useState([]);
  const [countries, setCountries] = useState([]);
  const [cities, setCities] = useState([]);
  const [citiesError, setCitiesError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [sortBy, setSortBy] = useState("created-desc");
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

  async function loadAll() {
    setLoading(true);
    setError("");

    const [countriesResult, mugsResult, citiesResult] = await Promise.all([
      supabase
        .from("countries")
        .select("id, iso2_code, name_en, name_ru")
        .order("name_en", { ascending: true }),

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
          is_published,
          created_at,
          updated_at,
          country:countries (
            id,
            iso2_code,
            name_en,
            name_ru
          )
        `)
        .order("created_at", { ascending: false }),

      supabase
        .from("cities")
        .select("id, key, country_id, name_en, name_ru, latitude, longitude, is_active")
        .eq("is_active", true)
        .order("name_en", { ascending: true }),
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
    setCities(citiesResult.error ? [] : citiesResult.data ?? []);
    setCitiesError(
      citiesResult.error
        ? "Не удалось загрузить справочник городов из базы. Проверьте, что таблица cities создана и заполнена."
        : ""
    );
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const countriesById = useMemo(() => {
    const map = new Map();

    countries.forEach((country) => {
      map.set(String(country.id), country);
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

  const countryDisplayOptions = useMemo(() => {
    return countries.map((country) => ({
      value: String(country.id),
      label: `${country.name_en}${country.name_ru ? ` / ${country.name_ru}` : ""}`,
    }));
  }, [countries]);

  const resolveCountryIso = useCallback(
    (countryId) => {
      const country = countriesById.get(String(countryId));
      return normalizeIso2(country?.iso2_code || "");
    },
    [countriesById]
  );

  const currentCountryIso = resolveCountryIso(form.country_id);

  const cityOptionsByCountryId = useMemo(() => {
    const map = new Map();

    cities.forEach((city) => {
      const countryId = String(city.country_id || "");
      if (!countryId) return;

      const countryIso = resolveCountryIso(countryId);
      const option = mapDbCityToOption(city, countryIso);
      const existingOptions = map.get(countryId) ?? [];
      existingOptions.push(option);
      map.set(countryId, existingOptions);
    });

    map.forEach((options, countryId) => {
      map.set(
        countryId,
        options.sort((a, b) => {
          return getLocalizedOptionLabel(a, "en").localeCompare(
            getLocalizedOptionLabel(b, "en"),
            "en"
          );
        })
      );
    });

    return map;
  }, [cities, resolveCountryIso]);

  const cityOptionsByCountryIso = useMemo(() => {
    const map = new Map();

    cities.forEach((city) => {
      const countryIso = resolveCountryIso(city.country_id);
      if (!countryIso) return;

      const option = mapDbCityToOption(city, countryIso);
      const existingOptions = map.get(countryIso) ?? [];
      existingOptions.push(option);
      map.set(countryIso, existingOptions);
    });

    map.forEach((options, countryIso) => {
      const uniqueOptions = options.filter((option, index, array) => {
        return array.findIndex((candidate) => candidate.key === option.key) === index;
      });

      map.set(
        countryIso,
        uniqueOptions.sort((a, b) => {
          return getLocalizedOptionLabel(a, "en").localeCompare(
            getLocalizedOptionLabel(b, "en"),
            "en"
          );
        })
      );
    });

    return map;
  }, [cities, resolveCountryIso]);

  const currentCountryLegacyCities = useMemo(() => {
    return mugs
      .filter((mug) => resolveCountryIso(mug.country_id) === currentCountryIso)
      .map((mug) => mug.city)
      .filter(Boolean);
  }, [mugs, currentCountryIso, resolveCountryIso]);

  const getAvailableCityOptions = useCallback(
    (countryId, legacyValues = []) => {
      const normalizedCountryId = String(countryId || "");
      const countryIso = resolveCountryIso(normalizedCountryId);
      const dbOptions =
        cityOptionsByCountryId.get(normalizedCountryId) ??
        cityOptionsByCountryIso.get(countryIso) ??
        [];

      const localOptions = localCityOptions.filter(
        (city) => city.countryId === normalizedCountryId
      );

      return mergeCityOptions(
        [...dbOptions, ...localOptions],
        legacyValues,
        countryIso,
        normalizedCountryId
      );
    },
    [cityOptionsByCountryId, cityOptionsByCountryIso, localCityOptions, resolveCountryIso]
  );

  const currentCityOptions = useMemo(() => {
    if (!form.country_id) return [];
    return getAvailableCityOptions(form.country_id, currentCountryLegacyCities);
  }, [form.country_id, currentCountryLegacyCities, getAvailableCityOptions]);

  const hasDbCitiesForCurrentCountry = useMemo(() => {
    if (!form.country_id) return false;
    const countryId = String(form.country_id);
    const countryIso = resolveCountryIso(countryId);

    return (
      (cityOptionsByCountryId.get(countryId) ?? []).length > 0 ||
      (cityOptionsByCountryIso.get(countryIso) ?? []).length > 0
    );
  }, [cityOptionsByCountryId, cityOptionsByCountryIso, form.country_id, resolveCountryIso]);

  function createFormState(mug = emptyForm) {
    const countryId = mug.country_id ? String(mug.country_id) : "";
    const availableCities = getAvailableCityOptions(
      countryId,
      mugs
        .filter((item) => String(item.country_id) === countryId)
        .map((item) => item.city)
        .filter(Boolean)
    );

    const selectedCityById = mug.city_id ? citiesById.get(String(mug.city_id)) : null;
    const cityKey =
      selectedCityById?.key ||
      mug.city_key ||
      availableCities.find((option) => option.label.en === mug.city || option.label.ru === mug.city)?.key ||
      "";

    const cityLabel = selectedCityById
      ? selectedCityById.name_en || selectedCityById.name_ru || mug.city || ""
      : getCityDisplayName(cityKey, mug.city || "", "en") || mug.city || "";

    return {
      id: mug.id || null,
      slug: mug.slug || "",
      title: mug.title || "",
      country_id: countryId,
      city_id: mug.city_id ? String(mug.city_id) : "",
      city: cityLabel,
      city_key: cityKey,
      type_values: getTypeValues(mug.collection_keys, mug.mug_type),
      received_at: mug.received_at || "",
      brought_by: mug.brought_by || "",
      brought_by_person_ids: ensureArray(
        mug.brought_by_person_ids || mug.brought_by_person_id
      ),
      color_keys: ensureArray(mug.color_keys),
      note: mug.note || "",
      is_published: mug.is_published == null ? true : !!mug.is_published,
    };
  }

  function openCreateForm() {
    setForm(emptyForm);
    setInitialForm(emptyForm);
    setPendingImageFiles([]);
    setIsFormOpen(true);
    setIsDiscardModalOpen(false);
    setError("");
  }

  function openEditForm(mug) {
    const initialFormData = createFormState(mug);
    setForm(initialFormData);
    setInitialForm(initialFormData);
    setPendingImageFiles([]);
    setIsFormOpen(true);
    setIsDiscardModalOpen(false);
    setError("");
  }

  function hasFormChanged() {
    return (
      JSON.stringify(form) !== JSON.stringify(initialForm) ||
      pendingImageFiles.length > 0
    );
  }

  function closeFormImmediately() {
    setForm(emptyForm);
    setInitialForm(emptyForm);
    setPendingImageFiles([]);
    setIsFormOpen(false);
    setIsDiscardModalOpen(false);
    setError("");
  }

  function requestCloseForm() {
    if (!hasFormChanged()) {
      closeFormImmediately();
      return;
    }

    setIsDiscardModalOpen(true);
  }

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateCountry(value) {
    const nextCityOptions = getAvailableCityOptions(
      value,
      mugs
        .filter((mug) => String(mug.country_id) === String(value))
        .map((mug) => mug.city)
        .filter(Boolean)
    );

    setForm((prev) => {
      const hasCurrentCity = nextCityOptions.some((option) => option.key === prev.city_key);

      return {
        ...prev,
        country_id: value,
        city_id: hasCurrentCity ? prev.city_id : "",
        city_key: hasCurrentCity ? prev.city_key : "",
        city: hasCurrentCity ? prev.city : "",
      };
    });
  }

  function updateCity(selectedValue) {
    const selectedCity = currentCityOptions.find((option) => option.key === selectedValue || option.id === selectedValue);

    setForm((prev) => ({
      ...prev,
      city_id: selectedCity?.id ? String(selectedCity.id) : "",
      city_key: selectedCity?.key || selectedValue || "",
      city: selectedCity ? selectedCity.label.en || selectedCity.label.ru || "" : "",
    }));
  }

  function closeCityCreator() {
    setIsCityCreatorOpen(false);
    setNewCityName("");
    setCityCreateError("");
  }

  async function createCity() {
    if (!form.country_id) {
      setCityCreateError("Выберите страну перед добавлением города.");
      return;
    }

    if (!newCityName.trim()) {
      setCityCreateError("Введите название города.");
      return;
    }

    setIsCreatingCity(true);
    setCityCreateError("");

    const cityKey = slugify(newCityName.trim());
    const payload = {
      key: cityKey,
      country_id: Number(form.country_id),
      name_en: newCityName.trim(),
      name_ru: newCityName.trim(),
      latitude: null,
      longitude: null,
      is_active: true,
    };

    const { data: cityData, error: cityError } = await supabase
      .from("cities")
      .insert(payload)
      .select("id, key, country_id, name_en, name_ru")
      .single();

    const unauthorizedWrite = cityError && (
      cityError.status === 401 ||
      cityError.status === 403 ||
      String(cityError.message || "").toLowerCase().includes("unauthorized") ||
      String(cityError.message || "").toLowerCase().includes("permission")
    );

    if (cityError && unauthorizedWrite) {
      const fallbackOption = {
        id: null,
        key: cityKey,
        countryId: String(form.country_id),
        label: {
          ru: newCityName.trim(),
          en: newCityName.trim(),
        },
      };

      setLocalCityOptions((prev) => {
        const existing = prev.find((item) => item.key === cityKey && item.countryId === String(form.country_id));
        if (existing) return prev;
        return [...prev, fallbackOption];
      });

      setError(
        "Не удалось создать город на сервере. Город сохранён локально для текущей кружки, но для полного добавления в базу настройте права Supabase или добавьте политику RLS."
      );
      setForm((prev) => ({
        ...prev,
        city_id: "",
        city_key: cityKey,
        city: newCityName.trim(),
      }));
      closeCityCreator();
      setIsCreatingCity(false);
      return;
    }

    if (cityError) {
      if (cityError.code === "23505" || String(cityError.message || "").toLowerCase().includes("duplicate")) {
        const { data: existingCity, error: lookupError } = await supabase
          .from("cities")
          .select("id, key, country_id, name_en, name_ru")
          .eq("key", cityKey)
          .single();

        if (lookupError || !existingCity) {
          setCityCreateError(lookupError?.message || "Не удалось найти дублирующий город.");
          setIsCreatingCity(false);
          return;
        }

        const cityInfo = existingCity;
        await loadAll();
        setForm((prev) => ({
          ...prev,
          city_id: String(cityInfo.id),
          city_key: cityInfo.key,
          city: cityInfo.name_en || cityInfo.name_ru || newCityName.trim(),
        }));
        closeCityCreator();
        setIsCreatingCity(false);
        return;
      }

      setCityCreateError(cityError.message || "Не удалось добавить город.");
      setIsCreatingCity(false);
      return;
    }

    await loadAll();
    setForm((prev) => ({
      ...prev,
      city_id: cityData.id ? String(cityData.id) : "",
      city_key: cityData.key || cityKey,
      city: cityData.name_en || cityData.name_ru || newCityName.trim(),
    }));
    closeCityCreator();
    setIsCreatingCity(false);
  }

  function toggleMultiValue(field, optionKey) {
    setForm((prev) => {
      const currentValues = ensureArray(prev[field]);
      const nextValues = currentValues.includes(optionKey)
        ? currentValues.filter((value) => value !== optionKey)
        : [...currentValues, optionKey];

      return {
        ...prev,
        [field]: nextValues,
      };
    });
  }

  function buildAvailableSlug(baseSlug, excludedMugId = null, reservedSlugs = new Set()) {
    const normalizedBase = normalizeSlug(baseSlug) || `mug-${Date.now()}`;
    const takenSlugs = new Set(reservedSlugs);

    mugs.forEach((mug) => {
      if (excludedMugId != null && String(mug.id) === String(excludedMugId)) {
        return;
      }

      const mugSlug = normalizeSlug(mug.slug);
      if (mugSlug) {
        takenSlugs.add(mugSlug);
      }
    });

    if (!takenSlugs.has(normalizedBase)) {
      return normalizedBase;
    }

    let suffix = 2;
    let candidate = `${normalizedBase}-${suffix}`;

    while (takenSlugs.has(candidate)) {
      suffix += 1;
      candidate = `${normalizedBase}-${suffix}`;
    }

    return candidate;
  }

  async function persistMug(payload, nowIso) {
    const reservedSlugs = new Set();
    const baseSlug = payload.slug;
    let lastError = null;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const nextSlug = buildAvailableSlug(baseSlug, form.id, reservedSlugs);
      const nextPayload = { ...payload, slug: nextSlug };
      const result = form.id
        ? await supabase.from("mugs").update(nextPayload).eq("id", form.id)
        : await supabase
            .from("mugs")
            .insert({ ...nextPayload, created_at: nowIso })
            .select("id, slug")
            .single();

      if (!result.error) {
        return {
          result,
          savedPayload: nextPayload,
        };
      }

      lastError = result.error;

      if (!isSlugConflict(result.error)) {
        throw result.error;
      }

      reservedSlugs.add(nextSlug);
    }

    throw (
      lastError ||
      new Error("Не удалось подобрать свободный slug. Попробуйте указать его вручную.")
    );
  }

  async function saveForm(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("Укажите название кружки.");
      return;
    }

    if (!form.country_id) {
      setError("Выберите страну.");
      return;
    }

    if (!form.city_key) {
      setError("Выберите город из готового списка.");
      return;
    }

    setSaving(true);
    setError("");

    const selectedCityOption =
      currentCityOptions.find(
        (option) => option.key === form.city_key || String(option.id) === String(form.city_id)
      ) || null;
    const cityLabel = selectedCityOption
      ? selectedCityOption.label.en || selectedCityOption.label.ru || ""
      : form.city.trim();
    const nowIso = new Date().toISOString();
    const baseSlug =
      normalizeSlug(form.slug) ||
      slugify([form.title, cityLabel].filter(Boolean).join(" ")) ||
      `mug-${Date.now()}`;
    const typeLabels = getTypeLabels(form.type_values, "ru");

    const payload = {
      slug: baseSlug,
      title: form.title.trim(),
      country_id: Number(form.country_id),
      city_id: selectedCityOption?.id ? String(selectedCityOption.id) : null,
      city_key: form.city_key || null,
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

    if (!payload.brought_by && payload.brought_by_person_ids.length > 0) {
      const { data: peopleData, error: peopleError } = await supabase
        .from("people")
        .select("first_name, last_name")
        .in("id", payload.brought_by_person_ids);

      if (!peopleError && Array.isArray(peopleData) && peopleData.length > 0) {
        payload.brought_by = peopleData
          .map((person) => `${person.first_name} ${person.last_name}`)
          .join(", ");
      }
    }

    let result;
    let savedMugId = form.id || "";
    let savedPayload = payload;

    try {
      const persisted = await persistMug(payload, nowIso);
      result = persisted.result;
      savedPayload = persisted.savedPayload;
    } catch (saveError) {
      setError(formatSaveError(saveError));
      setSaving(false);
      return;
    }

    if (result.error) {
      setError(formatSaveError(result.error));
      setSaving(false);
      return;
    }

    if (!form.id) {
      savedMugId = result.data?.id || "";
    }

    if (savedMugId && pendingImageFiles.length > 0) {
      try {
        await uploadImagesForMug(savedMugId, pendingImageFiles, 0);
        setPendingImageFiles([]);
      } catch (uploadError) {
        await loadAll();
        await onChanged?.();

        if (savedMugId) {
          const nextFormState = {
            ...form,
            id: savedMugId,
            slug: savedPayload.slug,
            city: payload.city || form.city,
            brought_by: payload.brought_by || "",
            brought_by_person_ids: payload.brought_by_person_ids,
            color_keys: payload.color_keys,
            type_values: payload.collection_keys,
            note: payload.note || "",
            received_at: payload.received_at || "",
            is_published: payload.is_published,
          };

          setPendingImageFiles([]);
          setForm(nextFormState);
          setInitialForm(nextFormState);
        }

        setError(
          uploadError.message ||
            "Кружка сохранена, но не удалось загрузить фотографии. Можно добавить их повторно уже в режиме редактирования."
        );
        setSaving(false);
        return;
      }
    }

    await loadAll();
    await onChanged?.();

    closeFormImmediately();
    setSaving(false);
  }

  async function deleteMug(mugId) {
    const confirmed = window.confirm("Удалить эту кружку?");
    if (!confirmed) return;

    setError("");

    const { error: deleteError } = await supabase.from("mugs").delete().eq("id", mugId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await loadAll();
    await onChanged?.();
  }

  const preparedMugs = useMemo(() => {
    return mugs.map((mug) => {
      const countryIso = resolveCountryIso(mug.country_id);
      const cityEntity = citiesById.get(String(mug.city_id));
      const cityLabel = cityEntity
        ? cityEntity.name_ru || cityEntity.name_en || mug.city || ""
        : getCityDisplayName(mug.city_key, mug.city, "ru") || mug.city || "";
      const cityFilterValue = cityEntity
        ? cityEntity.key
        : buildCityFilterValue(mug.city_key, mug.city, countryIso);
      const colorLabels = getColorLabels(mug.color_keys, "ru");
      const typeValues = getTypeValues(mug.collection_keys, mug.mug_type);
      const typeLabels = getTypeLabels(typeValues, "ru");

      return {
        ...mug,
        countryIso,
        cityLabel,
        cityFilterValue,
        colorLabels,
        typeValues,
        typeLabels,
      };
    });
  }, [mugs, resolveCountryIso, citiesById]);

  const typeOptions = useMemo(() => {
    const existingValues = preparedMugs.flatMap((mug) => mug.typeValues || []);
    return buildTypeOptions({
      selectedValues: form.type_values,
      existingValues,
      language: "ru",
    });
  }, [preparedMugs, form.type_values]);

  const cityFilterOptions = useMemo(() => {
    const optionMap = new Map();

    preparedMugs.forEach((mug) => {
      if (!mug.cityLabel) return;

      if (!optionMap.has(mug.cityFilterValue)) {
        optionMap.set(mug.cityFilterValue, {
          value: mug.cityFilterValue,
          label: mug.cityLabel,
        });
      }
    });

    return [...optionMap.values()].sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [preparedMugs]);

  const filteredMugs = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = preparedMugs.filter((mug) => {
      const matchesSearch =
        !query ||
        [
          mug.title,
          mug.slug,
          mug.cityLabel,
          mug.brought_by,
          mug.mug_type,
          mug.country?.name_en,
          mug.country?.name_ru,
          ...mug.colorLabels,
          ...mug.typeLabels,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesCity = !cityFilter || mug.cityFilterValue === cityFilter;

      return matchesSearch && matchesCity;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "created-asc":
          return String(a.created_at || "").localeCompare(String(b.created_at || ""));
        case "updated-desc":
          return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
        case "updated-asc":
          return String(a.updated_at || "").localeCompare(String(b.updated_at || ""));
        case "created-desc":
        default:
          return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      }
    });

    return filtered;
  }, [preparedMugs, search, cityFilter, sortBy]);

  return (
    <section className="card admin-card">
      <div className="admin-toolbar">
        <div>
          <div className="section-title">Администрирование кружек</div>
          <p className="admin-subtitle">
            Здесь можно добавлять, редактировать и удалять кружки, а также управлять их цветами, типами и городами.
          </p>
        </div>

        <div className="admin-actions" style={{ alignItems: "stretch" }}>
          <input
            className="admin-search"
            type="text"
            placeholder="Поиск по кружке, стране, цвету, типу"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            className="admin-search"
            value={cityFilter}
            onChange={(event) => setCityFilter(event.target.value)}
          >
            <option value="">Все города</option>
            {cityFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            className="admin-search"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            <option value="created-desc">Сначала недавно добавленные</option>
            <option value="created-asc">Сначала давно добавленные</option>
            <option value="updated-desc">Сначала недавно изменённые</option>
            <option value="updated-asc">Сначала давно изменённые</option>
          </select>

          <button className="secondary-button" onClick={loadAll} type="button" disabled={saving}>
            Обновить
          </button>
          <button
            className="primary-button"
            onClick={openCreateForm}
            type="button"
            disabled={isFormOpen}
          >
            Добавить кружку
          </button>
        </div>
      </div>

      {isFormOpen && (
        <form className="admin-form-card" onSubmit={saveForm} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={requestCloseForm}
            disabled={saving}
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              background: "none",
              border: "none",
              fontSize: "24px",
              color: "#999",
              cursor: "pointer",
              padding: "4px 8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Закрыть форму"
          >
            ✕
          </button>

          <div className="admin-form-grid">
            <label className="field">
              <span>Название *</span>
              <input
                type="text"
                value={form.title}
                onChange={(event) => updateForm("title", event.target.value)}
                placeholder="Например: Starbucks Warsaw Mug"
              />
            </label>

            <label className="field">
              <span>Slug</span>
              <input
                type="text"
                value={form.slug}
                onChange={(event) => updateForm("slug", event.target.value)}
                placeholder="Можно оставить пустым"
              />
            </label>

            <label className="field">
              <span>Страна *</span>
              <select
                value={form.country_id}
                onChange={(event) => updateCountry(event.target.value)}
              >
                <option value="">Выберите страну</option>
                {countryDisplayOptions.map((country) => (
                  <option key={country.value} value={country.value}>
                    {country.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field" style={{ position: "relative" }}>
              <span>Город *</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  value={form.city_key}
                  onChange={(event) => updateCity(event.target.value)}
                  disabled={!form.country_id}
                  style={{ flex: 1 }}
                >
                  <option value="">
                    {form.country_id ? "Выберите город" : "Сначала выберите страну"}
                  </option>
                  {currentCityOptions.map((city) => (
                    <option key={city.key} value={city.key}>
                      {getLocalizedOptionLabel(city, "ru")}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!form.country_id || isCreatingCity}
                  onClick={() => {
                    if (!form.country_id) {
                      setCityCreateError("Выберите страну перед добавлением города.");
                      return;
                    }
                    setIsCityCreatorOpen(true);
                  }}
                  style={{ minWidth: 44, padding: "0 12px" }}
                  title="Добавить новый город"
                >
                  +
                </button>
              </div>
              {citiesError ? (
                <span className="field-hint">{citiesError}</span>
              ) : form.country_id && !hasDbCitiesForCurrentCountry ? (
                <span className="field-hint">
                  Для выбранной страны в таблице `cities` пока нет городов. Добавьте их в базе, и они сразу появятся в списке.
                </span>
              ) : (
                <span className="field-hint">
                  Список городов берётся из таблицы `cities` и фильтруется по выбранной стране.
                </span>
              )}
            </label>
            {isCityCreatorOpen ? (
              <div
                style={{
                  marginTop: 8,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid #d1d5db",
                  background: "#f9fafb",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <input
                    type="text"
                    value={newCityName}
                    onChange={(event) => setNewCityName(event.target.value)}
                    placeholder="Введите название нового города"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="primary-button"
                    onClick={createCity}
                    disabled={isCreatingCity}
                  >
                    {isCreatingCity ? "Сохраняем..." : "Создать город"}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closeCityCreator}
                    disabled={isCreatingCity}
                  >
                    Отмена
                  </button>
                </div>
                {cityCreateError ? (
                  <div style={{ marginTop: 8, color: "#b91c1c" }}>{cityCreateError}</div>
                ) : null}
              </div>
            ) : null}

            <div className="field">
              <span>Тип</span>
              <TypeSelect
                value={form.type_values}
                options={typeOptions}
                onChange={(typeValues) =>
                  updateForm("type_values", typeValues || [])
                }
              />
            </div>

            <label className="field">
              <span>Дата получения</span>
              <input
                type="date"
                value={form.received_at}
                onChange={(event) => updateForm("received_at", event.target.value)}
              />
            </label>

            <label className="field">
              <span>Кто привёз (источник)</span>
              <PersonSelect
                value={form.brought_by_person_ids}
                onChange={(personIds, persons) => {
                  updateForm("brought_by_person_ids", personIds || []);

                  if (Array.isArray(persons) && persons.length > 0) {
                    updateForm(
                      "brought_by",
                      persons.map((person) => `${person.first_name} ${person.last_name}`).join(", ")
                    );
                  }
                }}
              />
            </label>

            <label className="field">
              <span>Кто привёз (текст для совместимости)</span>
              <input
                type="text"
                value={form.brought_by}
                onChange={(event) => updateForm("brought_by", event.target.value)}
                placeholder="Заполнится автоматически, но можно поправить"
              />
            </label>

            <div className="field field-wide">
              <span style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
                Основные цвета
              </span>
              <SelectableChipGroup
                options={COLOR_OPTIONS}
                values={form.color_keys}
                onToggle={(optionKey) => toggleMultiValue("color_keys", optionKey)}
                emptyText="Цвета пока недоступны"
                showSwatch
              />
            </div>

            <label className="checkbox-cell field-wide">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(event) => updateForm("is_published", event.target.checked)}
              />
              <span>Опубликовано</span>
            </label>

            <label className="field field-wide">
              <span>Заметка</span>
              <textarea
                rows="4"
                value={form.note}
                onChange={(event) => updateForm("note", event.target.value)}
                placeholder="Любая дополнительная информация"
              />
            </label>
          </div>

          <MugImagesManager
            mugId={form.id}
            pendingFiles={pendingImageFiles}
            onPendingFilesChange={setPendingImageFiles}
            onChanged={async () => {
              await loadAll();
              await onChanged?.();
            }}
          />

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Сохраняем..." : form.id ? "Сохранить" : "Создать"}
            </button>

            <button
              className="secondary-button"
              type="button"
              onClick={requestCloseForm}
              disabled={saving}
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="empty-state">
          <h2>Загрузка кружек…</h2>
          <p>Получаем данные из базы.</p>
        </div>
      ) : error ? (
        <div className="empty-state">
          <h2>Ошибка</h2>
          <p>{error}</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Страна</th>
                <th>Город</th>
                <th>Тип</th>
                <th>Цвета</th>
                <th>Дата получения</th>
                <th>Добавлена</th>
                <th>Последнее редактирование</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredMugs.map((mug) => (
                <tr key={mug.id}>
                  <td>
                    <div className="table-title">{mug.title}</div>
                    <div className="table-subtitle">{mug.slug}</div>
                  </td>
                  <td>{mug.country?.name_ru || mug.country?.name_en || "—"}</td>
                  <td>{mug.cityLabel || "—"}</td>
                  <td>{mug.typeLabels.join(", ") || "—"}</td>
                  <td>{mug.colorLabels.join(", ") || "—"}</td>
                  <td>{mug.received_at || "—"}</td>
                  <td>{formatDateTime(mug.created_at)}</td>
                  <td>{formatDateTime(mug.updated_at)}</td>
                  <td>
                    <span
                      className={
                        mug.is_published
                          ? "status-badge status-badge-light"
                          : "status-badge status-badge-gray"
                      }
                    >
                      {mug.is_published ? "published" : "draft"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="secondary-button"
                        onClick={() => openEditForm(mug)}
                        type="button"
                        disabled={isFormOpen || saving}
                      >
                        Редактировать
                      </button>
                      <button
                        className="danger-button"
                        onClick={() => deleteMug(mug.id)}
                        type="button"
                        disabled={isFormOpen || saving}
                      >
                        Удалить
                      </button>
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

      <ConfirmModal
        isOpen={isDiscardModalOpen}
        title="Закрыть форму без сохранения?"
        message="Вы внесли изменения в форму. Если закрыть её сейчас, несохранённые данные будут потеряны."
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
