import { useEffect, useMemo, useState } from "react";
import MugCarousel from "./MugCarousel";
import { MugEditDrawer } from "./MugsAdmin";
import { formatDate, normalizeIso2 } from "../lib/utils";

const EMPTY_VALUE = "";
const NOTE_CLAMP = 120;
const SIDEBAR_BREAKPOINT = 768;

const LABELS = {
  ru: {
    title: "Каталог кружек",
    subtitle: "Проверь коллекцию перед покупкой или подарком",
    searchPlaceholder: "Поиск по названию, городу, заметке, типу...",
    country: "Страна", state: "Штат / регион", city: "Город",
    collection: "Коллекция", color: "Цвет", sort: "Сортировка",
    allCountries: "Все страны", allStates: "Все штаты", allCities: "Все города",
    allCollections: "Все коллекции", allColors: "Все цвета",
    newest: "Сначала новые", oldest: "Сначала старые", titleAsc: "Название А–Я", numberDesc: "По номеру ↓", numberAsc: "По номеру ↑",
    found: "Найдено", mugs: "кружек", reset: "Сбросить всё",
    noResultsTitle: "Ничего не найдено", noResultsText: "Попробуй изменить фильтры.",
    type: "Тип", receivedAt: "Получена", broughtBy: "Привёз",
    note: "История", collections: "Коллекция", colors: "Цвет", unknown: "—",
    showMore: "Читать далее", showLess: "Свернуть",
    filters: "Фильтры", sorting: "Сортировка", clearAll: "Сбросить всё",
  },
  en: {
    title: "Mug catalog",
    subtitle: "Check the collection before buying or gifting",
    searchPlaceholder: "Search by title, city, note, type...",
    country: "Country", state: "State / region", city: "City",
    collection: "Collection", color: "Color", sort: "Sort",
    allCountries: "All countries", allStates: "All states", allCities: "All cities",
    allCollections: "All collections", allColors: "All colors",
    newest: "Newest first", oldest: "Oldest first", titleAsc: "Title A–Z", numberDesc: "By number ↓", numberAsc: "By number ↑",
    found: "Found", mugs: "mugs", reset: "Reset all",
    noResultsTitle: "Nothing found", noResultsText: "Try changing the filters.",
    type: "Type", receivedAt: "Received", broughtBy: "Brought by",
    note: "Story", collections: "Collection", colors: "Color", unknown: "—",
    showMore: "Read more", showLess: "Show less",
    filters: "Filters", sorting: "Sort", clearAll: "Clear all",
  },
};

const COLLECTION_LABELS = {
  ru: {
    been_here: "Been Here", been_there: "Been There", discovery: "Discovery",
    you_are_here: "You Are Here", icon: "Icon", relief: "Relief",
    city: "Городская", country: "Страна", ornament: "Орнамент",
    holiday: "Holiday", christmas: "Christmas", espresso: "Espresso",
    demitasse: "Demitasse", "city-series": "Городская", "been-there": "Been There",
    "new-year": "Новый год", winter: "Зимняя", spring: "Весенняя",
    "valentines-day": "День влюблённых", local: "Местная",
  },
  en: {
    been_here: "Been Here", been_there: "Been There", discovery: "Discovery",
    you_are_here: "You Are Here", icon: "Icon", relief: "Relief",
    city: "City", country: "Country", ornament: "Ornament",
    holiday: "Holiday", christmas: "Christmas", espresso: "Espresso",
    demitasse: "Demitasse", "city-series": "City Series", "been-there": "Been There",
    "new-year": "New Year", winter: "Winter", spring: "Spring",
    "valentines-day": "Valentine's Day", local: "Local",
  },
};

const COLOR_LABELS = {
  ru: {
    green: "Зелёный", blue: "Синий", red: "Красный", yellow: "Жёлтый",
    orange: "Оранжевый", brown: "Коричневый", black: "Чёрный", white: "Белый",
    gray: "Серый", grey: "Серый", purple: "Фиолетовый", pink: "Розовый",
    gold: "Золотой", silver: "Серебряный", beige: "Бежевый",
    turquoise: "Бирюзовый", multicolor: "Многоцветный", navy: "Тёмно-синий",
  },
  en: {
    green: "Green", blue: "Blue", red: "Red", yellow: "Yellow",
    orange: "Orange", brown: "Brown", black: "Black", white: "White",
    gray: "Gray", grey: "Gray", purple: "Purple", pink: "Pink",
    gold: "Gold", silver: "Silver", beige: "Beige",
    turquoise: "Turquoise", multicolor: "Multicolor", navy: "Navy",
  },
};

const COLOR_SWATCHES = {
  green: "#4CAF50", blue: "#2196F3", red: "#F44336", yellow: "#FFC107",
  orange: "#FF9800", brown: "#795548", black: "#212121", white: "#F5F5F5",
  gray: "#9E9E9E", grey: "#9E9E9E", purple: "#9C27B0", pink: "#E91E63",
  gold: "#FFD700", silver: "#C0C0C0", beige: "#D4B896", turquoise: "#00BCD4",
  multicolor: "linear-gradient(135deg,#f44336,#ff9800,#ffeb3b,#4caf50,#2196f3)",
  navy: "#1a237e",
};

function normalizeText(v) { return String(v || "").trim().toLowerCase(); }
function normalizeToken(v) { return String(v || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-+/g, "_"); }
function prettifyToken(t) { return String(t || "").replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()); }
function uniqueList(list) { return Array.from(new Set(list.filter(Boolean))); }

function parseTokenList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return uniqueList(value.map(normalizeToken));
  if (typeof value === "object") return uniqueList(Object.values(value).map(normalizeToken));
  const raw = String(value || "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return uniqueList(parsed.map(normalizeToken));
    if (parsed && typeof parsed === "object") return uniqueList(Object.values(parsed).map(normalizeToken));
  } catch { }
  const clean = raw.replace(/^\{/, "").replace(/\}$/, "").replace(/^\[/, "").replace(/\]$/, "");
  return uniqueList(clean.split(",").map(i => i.replace(/^"+|"+$/g, "")).map(normalizeToken));
}

function makeCityFilterKey(mug) {
  if (mug.city_id) return `id:${mug.city_id}`;
  const t = normalizeText(mug.city || mug.city_key || "");
  return t ? `raw:${t}` : "";
}

function getDateTime(v) {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

// Parse @handles and make them Instagram links
function renderBroughtBy(text) {
  if (!text) return null;
  const parts = text.split(/(@[\w.]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      const handle = part.slice(1);
      return (
        <a
          key={i}
          href={`https://instagram.com/${handle}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#1f6f54", fontWeight: 600, textDecoration: "none",
            borderBottom: "1px solid rgba(31,111,84,0.3)",
          }}
          onMouseEnter={e => e.target.style.borderBottomColor = "#1f6f54"}
          onMouseLeave={e => e.target.style.borderBottomColor = "rgba(31,111,84,0.3)"}
        >
          {part}
        </a>
      );
    }
    return part ? <span key={i}>{part}</span> : null;
  });
}

// ── MugCard ──────────────────────────────────────────────────────────────────

function MugCard({ mug, ui, countryName, stateName, cityText, collectionTokens, colorTokens, getCollectionLabel, getColorLabel, isAdmin, onEdit }) {
  const [noteExpanded, setNoteExpanded] = useState(false);
  const note = mug.note || "";
  const noteShort = note.length > NOTE_CLAMP ? note.slice(0, NOTE_CLAMP).trimEnd() + "…" : note;
  const hasLongNote = note.length > NOTE_CLAMP;

  return (
    <article style={{
      display: "flex", flexDirection: "column",
      background: "#ffffff", borderRadius: 16,
      border: "1px solid #e8e2d9", overflow: "hidden",
      transition: "box-shadow 0.2s, transform 0.2s",
      isolation: "isolate",
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,0,0,0.09)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {/* Photo — square crop */}
      <div style={{
        flexShrink: 0, background: "#f5f0e8", position: "relative", overflow: "hidden",
        aspectRatio: "1 / 1", width: "100%",
      }}>
        {/* Centered image wrapper */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MugCarousel images={mug.mug_images || []} fallbackAlt={mug.title} />
        </div>

        {/* Collection number badge */}
        {mug.collection_number && (
          <div style={{
            position: "absolute", top: 8, left: 8,
            background: "rgba(0,0,0,0.52)", color: "#fff",
            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
            zIndex: 2,
          }}>
            #{mug.collection_number}
          </div>
        )}

        {/* Admin edit button */}
        {isAdmin && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onEdit?.(mug); }}
            style={{
              position: "absolute", bottom: 8, right: 8, zIndex: 3,
              background: "rgba(31,111,84,0.9)", color: "#fff",
              border: "none", borderRadius: 8, padding: "4px 10px",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
              backdropFilter: "blur(4px)",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            ✎ Изменить
          </button>
        )}

        {/* Collection type badge */}
        {collectionTokens.length > 0 && (
          <div style={{
            position: "absolute", top: 8, right: 8, zIndex: 2,
            display: "flex", gap: 3, flexWrap: "wrap", maxWidth: "60%", justifyContent: "flex-end",
          }}>
            {collectionTokens.slice(0, 2).map(token => (
              <span key={token} style={{
                background: "rgba(21,49,38,0.78)", color: "#fff",
                fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 999,
                backdropFilter: "blur(4px)",
              }}>
                {getCollectionLabel(token)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Body — clear separation from photo */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        padding: "12px 14px 14px", gap: 8,
        background: "#fff", position: "relative", zIndex: 1,
      }}>

        {/* Title + date */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
          <h3 style={{
            margin: 0, fontSize: 13, fontWeight: 600, color: "#153126",
            lineHeight: 1.35, flex: 1, wordBreak: "break-word",
          }}>
            {mug.title}
          </h3>
          {mug.received_at && (
            <span style={{ fontSize: 10, color: "#8a9e96", flexShrink: 0, paddingTop: 2, whiteSpace: "nowrap" }}>
              {formatDate(mug.received_at)}
            </span>
          )}
        </div>

        {/* Geo */}
        <div style={{ fontSize: 12, color: "#5f6f66", lineHeight: 1.4 }}>
          {[countryName, stateName, cityText !== "—" ? cityText : null].filter(Boolean).join(" · ")}
        </div>

        {/* Who brought */}
        {mug.brought_by && (
          <div style={{ fontSize: 12, color: "#8a9e96" }}>
            ✈ {renderBroughtBy(mug.brought_by)}
          </div>
        )}

        {/* Colors */}
        {colorTokens.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {colorTokens.map(token => (
              <div
                key={token}
                title={getColorLabel(token)}
                style={{
                  width: 14, height: 14, borderRadius: "50%",
                  background: COLOR_SWATCHES[token] || "#ccc",
                  border: token === "white" ? "1px solid #ddd" : "none",
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        )}

        {/* Note */}
        {note && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", marginTop: 2 }}>
            <p style={{ margin: 0, fontSize: 11, color: "#6b7e74", lineHeight: 1.55, fontStyle: "italic" }}>
              {noteExpanded ? note : noteShort}
            </p>
            {hasLongNote && (
              <button
                type="button"
                onClick={() => setNoteExpanded(p => !p)}
                style={{
                  marginTop: 3, background: "none", border: "none", padding: 0,
                  color: "#1f6f54", fontSize: 11, fontWeight: 600, cursor: "pointer", textAlign: "left",
                }}
              >
                {noteExpanded ? ui.showLess : ui.showMore}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

// ── Sidebar filter section ────────────────────────────────────────────────────

function FilterSection({ title, options, selected, onSelect, withSwatches = false }) {
  const [expanded, setExpanded] = useState(true);
  const SHOW = 8;
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? options : options.slice(0, SHOW);

  return (
    <div style={{ borderBottom: "0.5px solid #e8e2d9", paddingBottom: 14 }}>
      <button
        type="button"
        onClick={() => setExpanded(p => !p)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "none", border: "none", padding: "10px 0 6px", cursor: "pointer",
          fontSize: 12, fontWeight: 600, color: "#31443a", textTransform: "uppercase", letterSpacing: "0.04em",
        }}
      >
        {title}
        <span style={{ fontSize: 10, color: "#8a9e96", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
      </button>

      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {visible.map(opt => {
            const active = selected === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSelect(active ? EMPTY_VALUE : opt.value)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "6px 8px", borderRadius: 8, border: "none",
                  background: active ? "#e8f5ee" : "transparent",
                  color: active ? "#1a6340" : "#374151",
                  cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 400,
                  textAlign: "left", transition: "background 0.1s",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#f5f0e8"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
                  {withSwatches && COLOR_SWATCHES[opt.value] && (
                    <span style={{
                      width: 12, height: 12, borderRadius: "50%", flexShrink: 0,
                      background: COLOR_SWATCHES[opt.value],
                      border: opt.value === "white" ? "1px solid #ccc" : "none",
                    }} />
                  )}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {opt.label}
                  </span>
                </span>
                <span style={{
                  fontSize: 11, color: active ? "#1a6340" : "#9ca3af",
                  background: active ? "#c8e8d8" : "#f3f4f6",
                  borderRadius: 999, padding: "1px 7px", flexShrink: 0, marginLeft: 4,
                }}>
                  {opt.count}
                </span>
              </button>
            );
          })}
          {options.length > SHOW && (
            <button
              type="button"
              onClick={() => setShowAll(p => !p)}
              style={{
                background: "none", border: "none", padding: "4px 8px",
                fontSize: 12, color: "#1f6f54", cursor: "pointer", textAlign: "left", fontWeight: 500,
              }}
            >
              {showAll ? "Скрыть" : `Ещё ${options.length - SHOW}...`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mobile filter sheet ───────────────────────────────────────────────────────

function MobileFilterSheet({ isOpen, onClose, children, title }) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300 }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 301,
        background: "#fff", borderRadius: "20px 20px 0 0",
        maxHeight: "85vh", display: "flex", flexDirection: "column",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.15)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "0.5px solid #e8e2d9", flexShrink: 0,
        }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#153126" }}>{title}</span>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 32px" }}>{children}</div>
      </div>
    </>
  );
}

// ── CatalogPage ───────────────────────────────────────────────────────────────

function CatalogPage({
  mugs = [],
  countries = [],
  states = [],
  cities = [],
  people = [],
  selectedCountryIso = "",
  selectedStateCode = "",
  selectedCountryLabel = "",
  language = "ru",
  isAdmin = false,
  onMugChanged,
}) {
  const ui = LABELS[language] || LABELS.ru;

  const [editingMug, setEditingMug] = useState(null);

  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < SIDEBAR_BREAKPOINT);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < SIDEBAR_BREAKPOINT);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const countriesById = useMemo(() => { const m = new Map(); countries.forEach(c => m.set(String(c.id), c)); return m; }, [countries]);
  const countriesByIso = useMemo(() => { const m = new Map(); countries.forEach(c => { const iso = normalizeIso2(c.iso2_code); if (iso) m.set(iso, c); }); return m; }, [countries]);
  const statesById = useMemo(() => { const m = new Map(); states.forEach(s => m.set(String(s.id), s)); return m; }, [states]);
  const statesByCode = useMemo(() => { const m = new Map(); states.forEach(s => { const cid = String(s.country_id || ""); const code = normalizeText(s.code || ""); if (cid && code) m.set(`${cid}:${code}`, s); }); return m; }, [states]);
  const citiesById = useMemo(() => { const m = new Map(); cities.forEach(c => m.set(String(c.id), c)); return m; }, [cities]);

  const initialCountryId = useMemo(() => {
    const iso = normalizeIso2(selectedCountryIso);
    if (!iso) return EMPTY_VALUE;
    const c = countriesByIso.get(iso);
    return c ? String(c.id) : EMPTY_VALUE;
  }, [countriesByIso, selectedCountryIso]);

  const initialStateId = useMemo(() => {
    if (!initialCountryId || !selectedStateCode) return EMPTY_VALUE;
    const s = statesByCode.get(`${initialCountryId}:${normalizeText(selectedStateCode)}`);
    return s ? String(s.id) : EMPTY_VALUE;
  }, [initialCountryId, selectedStateCode, statesByCode]);

  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState(initialCountryId);
  const [stateFilter, setStateFilter] = useState(initialStateId);
  const [cityFilter, setCityFilter] = useState(EMPTY_VALUE);
  const [collectionFilter, setCollectionFilter] = useState(EMPTY_VALUE);
  const [colorFilter, setColorFilter] = useState(EMPTY_VALUE);
  const [sortMode, setSortMode] = useState("numberDesc");

  useEffect(() => { if (initialCountryId) setCountryFilter(initialCountryId); }, [initialCountryId]);
  useEffect(() => { if (initialStateId) setStateFilter(initialStateId); }, [initialStateId]);

  function getCountryName(c) {
    if (!c) return ui.unknown;
    return language === "en" ? (c.name_en || c.name_ru || c.iso2_code || ui.unknown) : (c.name_ru || c.name_en || c.iso2_code || ui.unknown);
  }
  function getStateName(s) {
    if (!s) return "";
    return language === "en" ? (s.name_en || s.name_ru || s.code || "") : (s.name_ru || s.name_en || s.code || "");
  }
  function getCityText(mug) {
    const city = citiesById.get(String(mug.city_id || ""));
    if (city) {
      return language === "en"
        ? (city.name_en || city.name_ru || mug.city || ui.unknown)
        : (city.name_ru || city.name_en || mug.city || ui.unknown);
    }
    // Legacy: use mug.city text directly (already localized in DB)
    return mug.city || mug.city_key || ui.unknown;
  }
  function getCollectionLabel(token) { return COLLECTION_LABELS[language]?.[token] || COLLECTION_LABELS.ru[token] || prettifyToken(token); }
  function getColorLabel(token) { return COLOR_LABELS[language]?.[token] || COLOR_LABELS.ru[token] || prettifyToken(token); }

  function mugMatchesGeo(mug) {
    if (countryFilter && String(mug.country_id || "") !== countryFilter) return false;
    if (stateFilter && String(mug.state_id || "") !== stateFilter) return false;
    if (cityFilter && makeCityFilterKey(mug) !== cityFilter) return false;
    return true;
  }

  // ── Filter options with counts ──

  const countryOptions = useMemo(() => {
    const counts = new Map();
    mugs.forEach(m => {
      const k = String(m.country_id || "");
      if (k) counts.set(k, (counts.get(k) || 0) + 1);
    });
    return countries
      .filter(c => counts.has(String(c.id)))
      .map(c => ({ value: String(c.id), label: getCountryName(c), count: counts.get(String(c.id)) || 0 }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [countries, mugs, language]);

  const stateOptions = useMemo(() => {
    const map = new Map();
    mugs.forEach(mug => {
      if (countryFilter && String(mug.country_id || "") !== countryFilter) return;
      const s = statesById.get(String(mug.state_id || ""));
      if (!s) return;
      const k = String(s.id);
      if (!map.has(k)) map.set(k, { value: k, label: getStateName(s), count: 0 });
      map.get(k).count++;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [mugs, statesById, countryFilter, language]);

  const cityOptions = useMemo(() => {
    const map = new Map();
    mugs.forEach(mug => {
      if (countryFilter && String(mug.country_id || "") !== countryFilter) return;
      if (stateFilter && String(mug.state_id || "") !== stateFilter) return;
      const key = makeCityFilterKey(mug);
      if (!key) return;
      if (!map.has(key)) {
        // Prefer name from cities table (localized), fallback to mug.city
        const cityRecord = citiesById.get(String(mug.city_id || ""));
        const label = cityRecord
          ? (language === "en" ? (cityRecord.name_en || cityRecord.name_ru) : (cityRecord.name_ru || cityRecord.name_en)) || mug.city || key
          : mug.city || key;
        map.set(key, { value: key, label: label || key, count: 0 });
      }
      map.get(key).count++;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [mugs, citiesById, countryFilter, stateFilter, language]);

  const collectionOptions = useMemo(() => {
    const counts = new Map();
    mugs.forEach(mug => {
      if (!mugMatchesGeo(mug)) return;
      parseTokenList(mug.collection_keys).forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
    });
    return Array.from(counts.entries())
      .map(([t, count]) => ({ value: t, label: getCollectionLabel(t), count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [mugs, countryFilter, stateFilter, cityFilter, language]);

  const colorOptions = useMemo(() => {
    const counts = new Map();
    mugs.forEach(mug => {
      if (!mugMatchesGeo(mug)) return;
      parseTokenList(mug.color_keys).forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
    });
    return Array.from(counts.entries())
      .map(([t, count]) => ({ value: t, label: getColorLabel(t), count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [mugs, countryFilter, stateFilter, cityFilter, language]);

  // ── Filtered mugs ──

  const filteredMugs = useMemo(() => {
    const query = normalizeText(searchQuery);
    return mugs
      .filter(mug => {
        if (!mugMatchesGeo(mug)) return false;
        if (collectionFilter && !parseTokenList(mug.collection_keys).includes(collectionFilter)) return false;
        if (colorFilter && !parseTokenList(mug.color_keys).includes(colorFilter)) return false;
        if (!query) return true;
        const country = countriesById.get(String(mug.country_id || ""));
        const state = statesById.get(String(mug.state_id || ""));
        const text = [
          mug.title, mug.slug, mug.city, mug.city_key, getCityText(mug),
          mug.mug_type, mug.brought_by, mug.note,
          getCountryName(country), getStateName(state),
          ...parseTokenList(mug.collection_keys).map(getCollectionLabel),
          ...parseTokenList(mug.color_keys).map(getColorLabel),
        ].map(normalizeText).join(" ");
        return text.includes(query);
      })
      .sort((a, b) => {
        if (sortMode === "oldest") return getDateTime(a.received_at) - getDateTime(b.received_at);
        if (sortMode === "titleAsc") return String(a.title || "").localeCompare(String(b.title || ""));
        if (sortMode === "numberDesc") return (Number(b.collection_number) || 0) - (Number(a.collection_number) || 0);
        if (sortMode === "numberAsc") return (Number(a.collection_number) || 0) - (Number(b.collection_number) || 0);
        return getDateTime(b.received_at) - getDateTime(a.received_at);
      });
  }, [mugs, searchQuery, countryFilter, stateFilter, cityFilter, collectionFilter, colorFilter, sortMode, countriesById, statesById, citiesById, language]);

  function handleCountryChange(v) { setCountryFilter(v); setStateFilter(EMPTY_VALUE); setCityFilter(EMPTY_VALUE); }
  function handleStateChange(v) { setStateFilter(v); setCityFilter(EMPTY_VALUE); }

  function resetFilters() {
    setSearchQuery(""); setCountryFilter(EMPTY_VALUE); setStateFilter(EMPTY_VALUE);
    setCityFilter(EMPTY_VALUE); setCollectionFilter(EMPTY_VALUE); setColorFilter(EMPTY_VALUE);
    setSortMode("newest");
  }

  // Active filter tags
  const activeTags = useMemo(() => {
    const tags = [];
    if (countryFilter) {
      const c = countries.find(x => String(x.id) === countryFilter);
      if (c) tags.push({ key: "country", label: getCountryName(c), clear: () => handleCountryChange(EMPTY_VALUE) });
    }
    if (stateFilter) {
      const s = statesById.get(stateFilter);
      if (s) tags.push({ key: "state", label: getStateName(s), clear: () => handleStateChange(EMPTY_VALUE) });
    }
    if (cityFilter) {
      const opt = cityOptions.find(o => o.value === cityFilter);
      if (opt) tags.push({ key: "city", label: opt.label, clear: () => setCityFilter(EMPTY_VALUE) });
    }
    if (collectionFilter) {
      tags.push({ key: "collection", label: getCollectionLabel(collectionFilter), clear: () => setCollectionFilter(EMPTY_VALUE) });
    }
    if (colorFilter) {
      tags.push({ key: "color", label: getColorLabel(colorFilter), clear: () => setColorFilter(EMPTY_VALUE) });
    }
    return tags;
  }, [countryFilter, stateFilter, cityFilter, collectionFilter, colorFilter, countries, statesById, cityOptions, language]);

  const sortLabel = { newest: ui.newest, oldest: ui.oldest, titleAsc: ui.titleAsc, numberDesc: ui.numberDesc, numberAsc: ui.numberAsc }[sortMode] || ui.numberDesc;

  const SidebarContent = () => (
    <>
      <FilterSection title={ui.country} options={countryOptions} selected={countryFilter} onSelect={handleCountryChange} />
      {stateOptions.length > 0 && (
        <FilterSection title={ui.state} options={stateOptions} selected={stateFilter} onSelect={handleStateChange} />
      )}
      {cityOptions.length > 0 && (
        <FilterSection title={ui.city} options={cityOptions} selected={cityFilter} onSelect={setCityFilter} />
      )}
      {collectionOptions.length > 0 && (
        <FilterSection title={ui.collection} options={collectionOptions} selected={collectionFilter} onSelect={setCollectionFilter} />
      )}
      {colorOptions.length > 0 && (
        <FilterSection title={ui.color} options={colorOptions} selected={colorFilter} onSelect={setColorFilter} withSwatches />
      )}
    </>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "240px 1fr", minHeight: 600, background: "#faf7f3" }}>

      {/* ── Desktop sidebar ── */}
      {!isMobile && (
        <div style={{
          background: "#fff", borderRight: "0.5px solid #e8e2d9",
          padding: "16px 14px", display: "flex", flexDirection: "column", gap: 4,
          alignSelf: "start", position: "sticky", top: 0, maxHeight: "100vh", overflowY: "auto",
        }}>
          <div style={{ padding: "6px 8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#31443a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {ui.filters}
            </span>
            {activeTags.length > 0 && (
              <button type="button" onClick={resetFilters} style={{ background: "none", border: "none", fontSize: 11, color: "#1f6f54", cursor: "pointer", fontWeight: 600 }}>
                {ui.clearAll}
              </button>
            )}
          </div>
          <SidebarContent />
        </div>
      )}

      {/* ── Main ── */}
      <div style={{ display: "flex", flexDirection: "column" }}>

        {/* Mobile top bar */}
        {isMobile && (
          <div style={{ display: "flex", gap: 8, padding: "10px 12px", background: "#fff", borderBottom: "0.5px solid #e8e2d9" }}>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              style={{
                flex: 1, padding: "9px 14px", border: "0.5px solid #e8e2d9", borderRadius: 10,
                background: activeTags.length > 0 ? "#e8f5ee" : "#fff",
                color: activeTags.length > 0 ? "#1a6340" : "#374151",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              ⚙ {ui.filters}
              {activeTags.length > 0 && (
                <span style={{ background: "#1f6f54", color: "#fff", borderRadius: 999, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>
                  {activeTags.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMobileSortOpen(true)}
              style={{
                flex: 1, padding: "9px 14px", border: "0.5px solid #e8e2d9", borderRadius: 10,
                background: "#fff", color: "#374151",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}
            >
              ↕ {sortLabel}
            </button>
          </div>
        )}

        {/* Search + sort header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          padding: "12px 16px", background: "#fff", borderBottom: "0.5px solid #e8e2d9",
        }}>
          <div style={{ position: "relative", flex: "1 1 200px" }}>
            <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#8a9e96", pointerEvents: "none" }}>🔍</span>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={ui.searchPlaceholder}
              style={{
                width: "100%", border: "0.5px solid #e2ddd4", borderRadius: 10,
                padding: "9px 12px 9px 34px", fontSize: 13, outline: "none",
                background: "#faf7f3", color: "#1f2937", boxSizing: "border-box",
              }}
            />
          </div>

          {!isMobile && (
            <select
              value={sortMode}
              onChange={e => setSortMode(e.target.value)}
              style={{
                padding: "9px 12px", border: "0.5px solid #e2ddd4", borderRadius: 10,
                background: "#faf7f3", fontSize: 13, color: "#374151", outline: "none", cursor: "pointer",
              }}
            >
              <option value="numberDesc">{ui.numberDesc}</option>
              <option value="numberAsc">{ui.numberAsc}</option>
              <option value="newest">{ui.newest}</option>
              <option value="oldest">{ui.oldest}</option>
              <option value="titleAsc">{ui.titleAsc}</option>
            </select>
          )}

          <span style={{ fontSize: 12, color: "#8a9e96", whiteSpace: "nowrap" }}>
            {ui.found}: <strong style={{ color: "#153126" }}>{filteredMugs.length}</strong> {ui.mugs}
          </span>
        </div>

        {/* Active filter tags */}
        {activeTags.length > 0 && (
          <div style={{
            display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center",
            padding: "8px 16px", background: "#fff", borderBottom: "0.5px solid #e8e2d9",
          }}>
            {activeTags.map(tag => (
              <button
                key={tag.key}
                type="button"
                onClick={tag.clear}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "3px 10px 3px 8px", borderRadius: 999,
                  background: "#e8f5ee", color: "#1a6340",
                  border: "none", fontSize: 12, fontWeight: 500, cursor: "pointer",
                }}
              >
                {tag.label}
                <span style={{ fontSize: 14, opacity: 0.6, lineHeight: 1 }}>×</span>
              </button>
            ))}
            <button
              type="button"
              onClick={resetFilters}
              style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 12, color: "#1f6f54", cursor: "pointer", fontWeight: 600 }}
            >
              {ui.clearAll}
            </button>
          </div>
        )}

        {/* Grid */}
        {filteredMugs.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>☕</div>
            <h2 style={{ fontSize: 18, color: "#153126", marginBottom: 8 }}>{ui.noResultsTitle}</h2>
            <p style={{ fontSize: 14, color: "#8a9e96", marginBottom: 16 }}>{ui.noResultsText}</p>
            <button type="button" onClick={resetFilters} style={{
              padding: "9px 20px", borderRadius: 10, border: "1px solid #1f6f54",
              background: "transparent", color: "#1f6f54", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>
              {ui.clearAll}
            </button>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14, padding: 16,
          }}>
            {filteredMugs.map(mug => {
              const country = countriesById.get(String(mug.country_id || ""));
              const state = statesById.get(String(mug.state_id || ""));
              return (
                <MugCard
                  key={mug.id}
                  mug={mug}
                  ui={ui}
                  countryName={getCountryName(country)}
                  stateName={getStateName(state)}
                  cityText={getCityText(mug)}
                  collectionTokens={parseTokenList(mug.collection_keys)}
                  colorTokens={parseTokenList(mug.color_keys)}
                  getCollectionLabel={getCollectionLabel}
                  getColorLabel={getColorLabel}
                  isAdmin={isAdmin}
                  onEdit={setEditingMug}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Mobile filter sheet ── */}
      <MobileFilterSheet isOpen={mobileFiltersOpen} onClose={() => setMobileFiltersOpen(false)} title={ui.filters}>
        <SidebarContent />
        <div style={{ paddingTop: 16, display: "flex", gap: 10 }}>
          <button type="button" onClick={resetFilters} style={{
            flex: 1, padding: "11px", border: "0.5px solid #e2ddd4", borderRadius: 10,
            background: "transparent", fontSize: 13, color: "#374151", cursor: "pointer",
          }}>{ui.clearAll}</button>
          <button type="button" onClick={() => setMobileFiltersOpen(false)} style={{
            flex: 2, padding: "11px", border: "none", borderRadius: 10,
            background: "#1f6f54", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            Показать {filteredMugs.length} {ui.mugs}
          </button>
        </div>
      </MobileFilterSheet>

      {/* ── Mobile sort sheet ── */}
      <MobileFilterSheet isOpen={mobileSortOpen} onClose={() => setMobileSortOpen(false)} title={ui.sort}>
        {["numberDesc", "numberAsc", "newest", "oldest", "titleAsc"].map(mode => (
          <button
            key={mode}
            type="button"
            onClick={() => { setSortMode(mode); setMobileSortOpen(false); }}
            style={{
              display: "block", width: "100%", padding: "14px 16px",
              border: "none", borderBottom: "0.5px solid #e8e2d9",
              background: sortMode === mode ? "#e8f5ee" : "transparent",
              color: sortMode === mode ? "#1a6340" : "#374151",
              fontSize: 14, fontWeight: sortMode === mode ? 600 : 400,
              cursor: "pointer", textAlign: "left",
            }}
          >
            {ui[mode] || mode}
            {sortMode === mode && <span style={{ float: "right" }}>✓</span>}
          </button>
        ))}
      </MobileFilterSheet>

      {/* Admin inline edit drawer */}
      {isAdmin && editingMug && (
        <MugEditDrawer
          mugId={editingMug.id}
          language={language}
          onClose={() => setEditingMug(null)}
          onChanged={() => { setEditingMug(null); onMugChanged?.(); }}
        />
      )}
    </div>
  );
}

export default CatalogPage;
