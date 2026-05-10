import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { getMugImageUrl } from "./lib/storage";
import CountriesAdmin from "./components/CountriesAdmin";
import ErrorBoundary from "./components/ErrorBoundary";
import MugsAdmin from "./components/MugsAdmin";
import MugCarousel from "./components/MugCarousel";
import GlobeMapAsync from "./components/GlobeMapAsync";
import CatalogPage from "./components/CatalogPage";
import PeoplePage from "./components/PeoplePage";

import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import { normalizeIso2, formatDate } from "./lib/utils";

const ADMIN_TOKEN_STORAGE_KEY = "khodar_admin_token";
const ADMIN_ONLY_VIEWS = new Set(["countries"]);
const MOBILE_BREAKPOINT = 768;

// ─── Hero text ────────────────────────────────────────────────────────────────

// Count full years since November 2011 (collection started that month)
function getCollectionYears() {
  const start = new Date(2011, 10, 1); // Nov 1, 2011
  return Math.floor((Date.now() - start.getTime()) / (365.25 * 24 * 3600 * 1000));
}

// Russian: 1 страна / 2-4 страны / 5+ стран
function ruCountries(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m100 >= 11 && m100 <= 19) return `${n} стран`;
  if (m10 === 1) return `${n} страна`;
  if (m10 >= 2 && m10 <= 4) return `${n} страны`;
  return `${n} стран`;
}

// Russian: 1 год / 2-4 года / 5+ лет
function ruYears(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m100 >= 11 && m100 <= 19) return `${n} лет`;
  if (m10 === 1) return `${n} год`;
  if (m10 >= 2 && m10 <= 4) return `${n} года`;
  return `${n} лет`;
}

const HERO = {
  ru: {
    eyebrow: "Личная коллекция",
    title: (years, countries) => `${ruYears(years)}. ${ruCountries(countries)}.\nКаждая кружка — история.`,
    text: "Всё началось в 2011-м с первой кружки из Дублина, где я влюбился в Starbucks. С тех пор каждая кружка — это место, момент или человек: командировка в Женеву, ночь в Стамбуле с близкими друзьями, сюрприз из Нью-Йорка без повода. Некоторые кружки разбились — но здесь они живут.",
    stat1label: "кружек в коллекции",
    stat2label: (withMugs, total) => `${withMugs} из ${total} стран со Starbucks`,
    stat2sub: (missing) => `в ${missing} странах кружек ещё нет`,
    stat3label: "человек привезли кружки",
    stat3sub: "стали частью коллекции",
    legendTitle: "Легенда карты",
    l1: "Starbucks нет", l2: "Есть Starbucks, кружек пока нет", l3: "Есть кружки",
    hint: "Нажми на страну — отфильтрует каталог",
    mugsLabel: "кружек",
    remaining: (n) => `ещё ${n} стран ждут`,
  },
  en: {
    eyebrow: "Personal collection",
    title: (years, countries) => `${years} ${years === 1 ? "year" : "years"}. ${countries} ${countries === 1 ? "country" : "countries"}.\nEvery mug has a story.`,
    text: "It started in 2011 with the first mug from Dublin, where I fell in love with Starbucks. Since then every mug is a place, a moment, or a person: a work trip to Geneva, a night in Istanbul with close friends, a surprise from New York for no reason. Some mugs broke — but they live on here.",
    stat1label: "mugs in the collection",
    stat2label: (withMugs, total) => `${withMugs} of ${total} Starbucks countries`,
    stat2sub: (missing) => `${missing} countries still waiting`,
    stat3label: "people brought mugs",
    stat3sub: "became part of this story",
    legendTitle: "Map legend",
    l1: "No Starbucks", l2: "Starbucks, no mugs yet", l3: "Has mugs",
    hint: "Click a country to filter the catalog",
    mugsLabel: "mugs",
    remaining: (n) => `${n} more countries to go`,
  },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function extractRegionPayload(payload) {
  if (!payload) return { regionCode: "", countryIso: "", stateCode: "", label: "" };
  if (typeof payload === "object") {
    const regionCode = String(payload.regionCode || payload.code || payload.iso || payload.countryCode || "").trim().toUpperCase();
    const countryIso = normalizeIso2(payload.countryIso || payload.countryCode || payload.country_iso2 || (regionCode.startsWith("US-") ? "US" : regionCode));
    const stateCode = String(payload.stateCode || payload.state_code || (regionCode.startsWith("US-") ? regionCode : "")).trim().toUpperCase();
    return { regionCode, countryIso, stateCode, label: payload.name || payload.label || "" };
  }
  const regionCode = String(payload || "").trim().toUpperCase();
  return { regionCode, countryIso: regionCode.startsWith("US-") ? "US" : normalizeIso2(regionCode), stateCode: regionCode.startsWith("US-") ? regionCode : "", label: "" };
}

// ─── LanguageSwitch ───────────────────────────────────────────────────────────

function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: 3, borderRadius: 999, background: "#f5efe6", border: "1px solid #eadfce" }}>
      {["ru", "en"].map(lang => (
        <button key={lang} type="button" onClick={() => setLanguage(lang)} style={{
          border: "none", borderRadius: 999, padding: "5px 12px", cursor: "pointer",
          fontWeight: 600, fontSize: 13,
          background: language === lang ? "#1f6f54" : "transparent",
          color: language === lang ? "#fff" : "#1f2937",
          transition: "all 0.15s",
        }}>{lang.toUpperCase()}</button>
      ))}
    </div>
  );
}

// ─── AdminLoginModal ──────────────────────────────────────────────────────────

function AdminLoginModal({ isOpen, language, loading, error, onClose, onSubmit }) {
  const [password, setPassword] = useState("");
  useEffect(() => { if (!isOpen) setPassword(""); }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420, borderRadius: 24, background: "#fff", boxShadow: "0 20px 50px rgba(0,0,0,0.18)", padding: 24 }}>
        <form onSubmit={e => { e.preventDefault(); onSubmit(password); }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#153126", marginBottom: 18 }}>
            {language === "en" ? "Admin login" : "Вход для администратора"}
          </div>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder={language === "en" ? "Enter password" : "Введите пароль"} autoFocus
            style={{ width: "100%", border: "1px solid #d7dfd8", borderRadius: 14, padding: "12px 14px", fontSize: 15, outline: "none", boxSizing: "border-box" }} />
          {error && <div style={{ marginTop: 12, borderRadius: 12, background: "#fff3f3", border: "1px solid #f0d2d2", color: "#9a2e2e", padding: "10px 12px", fontSize: 14 }}>{error}</div>}
          <div style={{ marginTop: 18, display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} disabled={loading} className="secondary-button">{language === "en" ? "Cancel" : "Отмена"}</button>
            <button type="submit" disabled={loading || !password.trim()} className="primary-button">
              {loading ? (language === "en" ? "Checking..." : "Проверяем...") : (language === "en" ? "Login" : "Войти")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MobileStatsBar ───────────────────────────────────────────────────────────

function MobileStatsBar({ mugsCount, countriesWithMugsCount, countriesWithStarbucksCount, visibleFriendsCount, h, onPeopleClick }) {
  return (
    <div style={{
      display: "flex", overflowX: "auto", gap: 10, padding: "12px 16px",
      background: "#faf7f3", borderTop: "0.5px solid #e8e2d9",
      scrollbarWidth: "none",
    }}>
      <div style={{ flexShrink: 0, padding: "10px 16px", background: "#fff", borderRadius: 12, border: "0.5px solid #e8e2d9", minWidth: 120 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: "#153126", lineHeight: 1 }}>{mugsCount}</div>
        <div style={{ fontSize: 11, color: "#5f6f66", marginTop: 3, whiteSpace: "nowrap" }}>{h.stat1label}</div>
      </div>
      <div style={{ flexShrink: 0, padding: "10px 16px", background: "#fff", borderRadius: 12, border: "0.5px solid #e8e2d9", minWidth: 120 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: "#1f6f54", lineHeight: 1 }}>{countriesWithMugsCount}</div>
        <div style={{ fontSize: 11, color: "#5f6f66", marginTop: 3, whiteSpace: "nowrap" }}>{h.stat2label(countriesWithMugsCount, countriesWithStarbucksCount)}</div>
      </div>
      {/* People stat — clickable on mobile */}
      <button
        type="button"
        onClick={onPeopleClick}
        style={{
          flexShrink: 0, padding: "10px 16px", background: "#fff", borderRadius: 12,
          border: "0.5px solid #e8e2d9", minWidth: 120, textAlign: "left", cursor: "pointer",
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 700, color: "#153126", lineHeight: 1 }}>{visibleFriendsCount}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 3 }}>
          <span style={{ fontSize: 11, color: "#5f6f66", whiteSpace: "nowrap" }}>{h.stat3label}</span>
          <span style={{ fontSize: 11, color: "#1f6f54", fontWeight: 700 }}>→</span>
        </div>
      </button>
    </div>
  );
}

// ─── PeopleTeaser ─────────────────────────────────────────────────────────────

function PeopleTeaser({ people = [], mugs = [], language, onClick }) {
  // Pick top contributors (sorted by mug count)
  const topPeople = useMemo(() => {
    const counts = {};
    mugs.forEach(m => {
      const ids = Array.isArray(m.brought_by_person_ids) ? m.brought_by_person_ids
        : m.brought_by_person_id ? [m.brought_by_person_id] : [];
      ids.forEach(id => { if (id) counts[id] = (counts[id] || 0) + 1; });
    });
    return [...people]
      .filter(p => p.is_visible !== false)
      .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0))
      .slice(0, 7);
  }, [people, mugs]);

  const visibleCount = people.filter(p => p.is_visible !== false).length;
  const OVERLAP = 10; // px overlap between avatars

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center",
        width: "100%", padding: "18px 24px",
        background: "linear-gradient(to right, #f0faf5, #faf7f3)",
        border: "none", borderBottom: "0.5px solid #e8e2d9",
        cursor: "pointer", textAlign: "left",
        gap: 20,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(to right, #e4f5ed, #f5f0e8)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(to right, #f0faf5, #faf7f3)"; }}
    >
      {/* Overlapping avatar row */}
      <div style={{ display: "flex", flexShrink: 0 }}>
        {topPeople.map((person, i) => {
          const url = person.avatar_image_path ? getMugImageUrl(person.avatar_image_path) : null;
          const initials = [person.first_name?.[0], person.last_name?.[0]].filter(Boolean).join("").toUpperCase()
            || person.instagram_url?.replace(/^.*\//, "")?.replace(/^@/, "")?.[0]?.toUpperCase() || "?";
          return (
            <div key={person.id} style={{
              width: 40, height: 40, borderRadius: "50%",
              border: "2.5px solid #fff",
              marginLeft: i === 0 ? 0 : -OVERLAP,
              background: url ? `url(${url}) center/cover` : "linear-gradient(135deg,#1f6f54,#2d9970)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 13, fontWeight: 700,
              flexShrink: 0, zIndex: topPeople.length - i,
              boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
            }}>
              {!url && initials}
            </div>
          );
        })}
        {visibleCount > topPeople.length && (
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            border: "2.5px solid #fff",
            marginLeft: -OVERLAP,
            background: "#e8f5ee",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#1f6f54", fontSize: 11, fontWeight: 700,
            flexShrink: 0, zIndex: 0,
          }}>
            +{visibleCount - topPeople.length}
          </div>
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#153126", marginBottom: 2 }}>
          {language === "en" ? "People Behind the Collection" : "Люди за коллекцией"}
        </div>
        <div style={{ fontSize: 12, color: "#5f6f66" }}>
          {language === "en"
            ? `${visibleCount} friends from around the world helped build this collection`
            : `${visibleCount} друзей со всего мира помогли собрать эту коллекцию`}
        </div>
      </div>

      {/* Arrow */}
      <div style={{
        flexShrink: 0,
        width: 32, height: 32, borderRadius: "50%",
        background: "#1f6f54", color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, fontWeight: 700,
      }}>→</div>
    </button>
  );
}

// ─── AppContent ───────────────────────────────────────────────────────────────

function AppContent() {
  const { language, t } = useLanguage();
  const h = HERO[language] || HERO.ru;

  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [mugs, setMugs] = useState([]);
  const [people, setPeople] = useState([]);

  const [selectedRegionCode, setSelectedRegionCode] = useState("");
  const [selectedCountryIso, setSelectedCountryIso] = useState("");
  const [selectedStateCode, setSelectedStateCode] = useState("");
  const [hoveredRegionCode, setHoveredRegionCode] = useState("");

  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState("");
  const [warningMessage, setWarningMessage] = useState("");
  const [currentView, setCurrentView] = useState("home");

  const [mapPanelCountryIso, setMapPanelCountryIso] = useState("");

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [adminAuthLoading, setAdminAuthLoading] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState("");

  // ── Load ──────────────────────────────────────────────────────────────────

  const tryLoadTable = useCallback(async (queryFn, retryQueryFn = null) => {
    const result = await queryFn();
    if (!result.error) return result;
    const errText = [result.error.message, result.error.details, result.error.hint, result.error.code].filter(Boolean).join(" ");
    const shouldRetry = retryQueryFn && /(column .* does not exist|undefined column|relation .* does not exist|schema cache|pgrst204)/i.test(errText);
    return shouldRetry ? retryQueryFn() : result;
  }, []);

  const updateMug = useCallback(async (mugId) => {
    const { data } = await supabase
      .from("mugs")
      .select(`id, collection_number, country_id, country_iso2, state_id, state_code, city_id, slug, title, city, city_key, mug_type, received_at, brought_by, brought_by_person_ids, brought_by_person_id, color_keys, collection_keys, note, cover_image_path, is_published, created_at, updated_at, mug_images (id, mug_id, storage_path, sort_order, alt_text, created_at)`)
      .eq("id", mugId)
      .single();
    if (data) setMugs(prev => prev.map(m => m.id === mugId ? data : m));
  }, []);

  const removeMug = useCallback((mugId) => {
    setMugs(prev => prev.filter(m => m.id !== mugId));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true); setFatalError(""); setWarningMessage("");
    const [countriesRes, mugsRes, peopleRes, citiesRes, statesRes] = await Promise.all([
      tryLoadTable(
        () => supabase.from("countries").select("id, iso2_code, name_en, name_ru, has_starbucks_current, is_visible").eq("is_visible", true).order("name_en", { ascending: true }),
        () => supabase.from("countries").select("id, iso2_code, name_en, name_ru, has_starbucks_current").order("name_en", { ascending: true })
      ),
      tryLoadTable(
        () => supabase.from("mugs").select(`id, collection_number, country_id, country_iso2, state_id, state_code, city_id, slug, title, city, city_key, mug_type, received_at, brought_by, brought_by_person_ids, brought_by_person_id, color_keys, collection_keys, note, cover_image_path, is_published, created_at, updated_at, mug_images (id, mug_id, storage_path, sort_order, alt_text, created_at)`).eq("is_published", true).order("received_at", { ascending: false }),
        () => supabase.from("mugs").select(`id, collection_number, country_id, state_id, city_id, slug, title, city, city_key, mug_type, received_at, brought_by, brought_by_person_ids, brought_by_person_id, color_keys, collection_keys, note, cover_image_path, is_published, created_at, updated_at, mug_images (id, mug_id, storage_path, sort_order, alt_text, created_at)`).eq("is_published", true).order("received_at", { ascending: false })
      ),
      tryLoadTable(
        () => supabase.from("people").select("id, first_name, last_name, bio, avatar_image_path, instagram_url, is_visible").eq("is_visible", true).order("first_name", { ascending: true }),
        () => supabase.from("people").select("id, first_name, last_name, bio, avatar_image_path, instagram_url").order("first_name", { ascending: true })
      ),
      tryLoadTable(
        () => supabase.from("cities").select("id, key, country_id, state_id, name_en, name_ru, latitude, longitude, is_active, country_iso2, state_code, state_name_en, state_name_ru").eq("is_active", true).order("name_en", { ascending: true }).limit(10000),
        () => supabase.from("cities").select("id, key, country_id, state_id, name_en, name_ru, latitude, longitude").order("name_en", { ascending: true }).limit(10000)
      ),
      tryLoadTable(
        () => supabase.from("states").select("id, country_id, code, name_en, name_ru, is_active").eq("is_active", true).order("name_en", { ascending: true }),
        () => supabase.from("states").select("id, country_id, code, name_en, name_ru").order("name_en", { ascending: true })
      ),
    ]);

    if (countriesRes.error || mugsRes.error) {
      setFatalError(countriesRes.error?.message || mugsRes.error?.message || "Не удалось загрузить данные.");
      setCountries([]); setStates([]); setMugs([]); setPeople([]); setCities([]);
      setLoading(false); return;
    }
    setCountries(countriesRes.data ?? []);
    setMugs(mugsRes.data ?? []);
    setPeople((peopleRes.error ? [] : peopleRes.data ?? []).map(p => ({ ...p, is_visible: p.is_visible ?? true })));
    setCities(citiesRes.error ? [] : citiesRes.data ?? []);
    setStates(statesRes.error ? [] : statesRes.data ?? []);
    const warnings = [
      peopleRes.error ? `People: ${peopleRes.error.message}` : null,
      citiesRes.error ? `Cities: ${citiesRes.error.message}` : null,
      statesRes.error ? `States: ${statesRes.error.message}` : null,
    ].filter(Boolean);
    setWarningMessage(warnings.join(" / "));
    setLoading(false);
  }, [tryLoadTable]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try { await loadData(); }
      catch (err) { if (!cancelled) { setFatalError(err?.message || "Ошибка загрузки."); setLoading(false); } }
    }
    run();
    return () => { cancelled = true; };
  }, [loadData]);

  // ── Admin session ─────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      const token = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
      if (!token) return;
      try {
        const { data, error } = await supabase.functions.invoke("admin-verify", { headers: { Authorization: `Bearer ${token}` } });
        if (cancelled) return;
        if (error || !data?.ok) { localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY); return; }
        setAdminToken(token); setIsAdminAuthenticated(true);
      } catch { if (!cancelled) localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY); }
    }
    restore();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function handleKey(e) {
      if (e.ctrlKey && e.shiftKey && String(e.key || "").toLowerCase() === "a") {
        e.preventDefault();
        if (!isAdminAuthenticated) { setAdminAuthError(""); setIsLoginOpen(true); }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isAdminAuthenticated]);

  useEffect(() => {
    if (!isAdminAuthenticated && ADMIN_ONLY_VIEWS.has(currentView)) setCurrentView("home");
  }, [currentView, isAdminAuthenticated]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const countriesByIso = useMemo(() => {
    const m = new Map(); countries.forEach(c => { const iso = normalizeIso2(c.iso2_code); if (iso) m.set(iso, c); }); return m;
  }, [countries]);

  const citiesById = useMemo(() => {
    const m = new Map(); cities.forEach(c => m.set(String(c.id), c)); return m;
  }, [cities]);

  const statesById = useMemo(() => {
    const m = new Map(); states.forEach(s => m.set(String(s.id), s)); return m;
  }, [states]);

  const mugCountByCountryId = useMemo(() => {
    const m = new Map();
    mugs.forEach(mug => { const k = String(mug.country_id || ""); if (k) m.set(k, (m.get(k) ?? 0) + 1); });
    return m;
  }, [mugs]);

  const mugsByCountryId = useMemo(() => {
    const m = new Map();
    mugs.forEach(mug => { const k = String(mug.country_id || ""); if (!k) return; const cur = m.get(k) ?? []; cur.push(mug); m.set(k, cur); });
    return m;
  }, [mugs]);

  const countriesWithMugsCount = useMemo(() => countries.filter(c => (mugCountByCountryId.get(String(c.id)) ?? 0) > 0).length, [countries, mugCountByCountryId]);
  const countriesWithStarbucksCount = useMemo(() => countries.filter(c => !!c.has_starbucks_current).length, [countries]);
  const visibleFriendsCount = useMemo(() => people.filter(p => p.is_visible).length, [people]);

  const mugCountByStateCode = useMemo(() => {
    const m = new Map();
    mugs.forEach(mug => {
      const code = String(mug.state_code || "").trim().toUpperCase();
      if (code.startsWith("US-")) m.set(code, (m.get(code) ?? 0) + 1);
    });
    return m;
  }, [mugs]);

  const globeCountryData = useMemo(() => {
    const countryEntries = countries.map(country => ({
      id: country.id,
      code: normalizeIso2(country.iso2_code),
      name: language === "en" ? (country.name_en || country.name_ru || "") : (country.name_ru || country.name_en || ""),
      nameRu: country.name_ru || "", nameEn: country.name_en || "",
      hasStarbucks: !!country.has_starbucks_current,
      mugsCount: mugCountByCountryId.get(String(country.id)) ?? 0,
    }));

    const usCountry = countries.find(c => normalizeIso2(c.iso2_code) === "US");
    const stateEntries = states
      .filter(s => String(s.code || "").startsWith("US-"))
      .map(s => ({
        id: s.id,
        code: s.code.toUpperCase(),
        regionCode: s.code.toUpperCase(),
        name: language === "en" ? (s.name_en || s.name_ru || "") : (s.name_ru || s.name_en || ""),
        nameRu: s.name_ru || "", nameEn: s.name_en || "",
        hasStarbucks: !!usCountry?.has_starbucks_current,
        mugsCount: mugCountByStateCode.get(s.code.toUpperCase()) ?? 0,
      }));

    return [...countryEntries, ...stateEntries];
  }, [countries, states, mugCountByCountryId, mugCountByStateCode, language]);

  const panelCountryRecord = useMemo(() => mapPanelCountryIso ? countriesByIso.get(mapPanelCountryIso) ?? null : null, [countriesByIso, mapPanelCountryIso]);
  const panelMugs = useMemo(() => panelCountryRecord ? mugsByCountryId.get(String(panelCountryRecord.id)) ?? [] : [], [panelCountryRecord, mugsByCountryId]);

  // ── Globe handlers ────────────────────────────────────────────────────────

  const handleCountryHover = useCallback((payload) => {
    if (selectedRegionCode) return;
    const { regionCode } = extractRegionPayload(payload);
    setHoveredRegionCode(regionCode);
  }, [selectedRegionCode]);

  const handleCountryClick = useCallback((payload) => {
    const { regionCode, countryIso, stateCode } = extractRegionPayload(payload);
    if (!regionCode) { setSelectedRegionCode(""); setSelectedCountryIso(""); setSelectedStateCode(""); setHoveredRegionCode(""); setMapPanelCountryIso(""); return; }
    if (selectedRegionCode === regionCode) { setSelectedRegionCode(""); setSelectedCountryIso(""); setSelectedStateCode(""); setMapPanelCountryIso(""); return; }
    setSelectedRegionCode(regionCode); setSelectedCountryIso(countryIso); setSelectedStateCode(stateCode);
    setHoveredRegionCode(""); setMapPanelCountryIso(countryIso);
    document.getElementById("catalog-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedRegionCode]);

  const clearSelection = useCallback(() => {
    setSelectedRegionCode(""); setSelectedCountryIso(""); setSelectedStateCode("");
    setHoveredRegionCode(""); setMapPanelCountryIso("");
  }, []);

  // ── Display helpers ───────────────────────────────────────────────────────

  const getCountryDisplayName = useCallback((country) => {
    if (!country) return "—";
    return language === "en" ? (country.name_en || country.name_ru || country.iso2_code || "—") : (country.name_ru || country.name_en || country.iso2_code || "—");
  }, [language]);

  const getStateDisplayName = useCallback((mug) => {
    const state = statesById.get(String(mug.state_id || ""));
    if (!state) return "";
    return language === "en" ? (state.name_en || state.name_ru || state.code || "") : (state.name_ru || state.name_en || state.code || "");
  }, [statesById, language]);

  const getMugCityText = useCallback((mug) => {
    if (!mug) return "—";
    const city = citiesById.get(String(mug.city_id || ""));
    if (city) return language === "en" ? (city.name_en || city.name_ru || mug.city || "—") : (city.name_ru || city.name_en || mug.city || "—");
    return mug.city || "—";
  }, [citiesById, language]);

  // ── Admin ──────────────────────────────────────────────────────────────────

  async function handleAdminLogin(password) {
    setAdminAuthLoading(true); setAdminAuthError("");
    try {
      const { data, error } = await supabase.functions.invoke("admin-login", { body: { password } });
      if (error || !data?.ok || !data?.token) { setAdminAuthError(language === "en" ? "Invalid password." : "Неверный пароль."); setAdminAuthLoading(false); return; }
      localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, data.token);
      setAdminToken(data.token); setIsAdminAuthenticated(true); setIsLoginOpen(false);
    } catch { setAdminAuthError(language === "en" ? "Login failed." : "Ошибка входа."); }
    setAdminAuthLoading(false);
  }

  function handleAdminLogout() {
    localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    setAdminToken(""); setIsAdminAuthenticated(false);
    if (ADMIN_ONLY_VIEWS.has(currentView)) setCurrentView("home");
  }

  async function openAdminView(viewName) {
    if (!adminToken) { setCurrentView(viewName); return; }
    try {
      const { data, error } = await supabase.functions.invoke("admin-verify", { headers: { Authorization: `Bearer ${adminToken}` } });
      if (error || !data?.ok) { handleAdminLogout(); return; }
      setCurrentView(viewName);
    } catch { handleAdminLogout(); }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const isAdminView = ADMIN_ONLY_VIEWS.has(currentView);

  if (loading) return (
    <div className="card"><div className="empty-state"><h2>{t("loadingTitle")}</h2><p>{t("loadingText")}</p></div></div>
  );

  if (fatalError) return (
    <div className="card"><div className="empty-state">
      <h2>{t("errorTitle")}</h2><p>{fatalError}</p>
      <button type="button" className="secondary-button" onClick={loadData} style={{ marginTop: 16 }}>{t("retry")}</button>
    </div></div>
  );

  return (
    <div className="page">

      {/* ── Navbar ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 52,
        background: "#fff", borderBottom: "0.5px solid #e8e2d9",
      }}>
        <button type="button" onClick={() => setCurrentView("home")} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1f6f54", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M18.5 3h-13C4.7 3 4 3.7 4 4.5v1c0 .4.2.8.5 1L6 8v9c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V8l1.5-1.5c.3-.2.5-.6.5-1v-1C20 3.7 19.3 3 18.5 3zm-2.5 5v9H8V8h8zm2-2.5L16.5 7h-9L6 5.5v-.5h12v.5z"/></svg>
          </div>
          {!isMobile && (
            <span style={{ fontSize: 14, fontWeight: 600, color: "#153126" }}>
              Khodar <span style={{ color: "#1f6f54" }}>Starbucks</span> Collection
            </span>
          )}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
          <LanguageSwitch />
          {isAdminAuthenticated ? (
            <>
              {/* Hide "Режим администратора" text on mobile, keep only on desktop */}
              {!isMobile && (
                <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "5px 10px", background: "#dff4e7", color: "#0d6f48", fontWeight: 600, fontSize: 12 }}>
                  {language === "en" ? "Admin" : "Режим администратора"}
                </span>
              )}
              <button type="button" className="secondary-button" onClick={handleAdminLogout} style={{ fontSize: 13 }}>
                {language === "en" ? "Logout" : "Выйти"}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => { setAdminAuthError(""); setIsLoginOpen(true); }}
              className="admin-login-mobile"
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, opacity: 0.2, padding: "4px 6px", lineHeight: 1 }}
              title="Войти как администратор"
            >⚙</button>
          )}
        </div>
      </nav>

      <AdminLoginModal isOpen={isLoginOpen} language={language} loading={adminAuthLoading} error={adminAuthError}
        onClose={() => { if (!adminAuthLoading) { setAdminAuthError(""); setIsLoginOpen(false); } }}
        onSubmit={handleAdminLogin} />

      {/* ── Admin views (countries only) ── */}
      {isAdminAuthenticated && isAdminView ? (
        <>
          <div style={{ display: "flex", gap: 4, padding: "8px 24px", background: "#f8f4ed", borderBottom: "0.5px solid #e8e2d9" }}>
            <button type="button" onClick={() => openAdminView("countries")} style={{
              padding: "6px 14px", border: "none", borderRadius: 8,
              background: currentView === "countries" ? "#1f6f54" : "transparent",
              color: currentView === "countries" ? "#fff" : "#374151",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
            }}>
              {language === "en" ? "Countries" : "Страны"}
            </button>
            <button type="button" onClick={() => setCurrentView("home")} style={{ marginLeft: "auto", padding: "6px 14px", border: "0.5px solid #e2ddd4", borderRadius: 8, background: "transparent", color: "#374151", fontSize: 13, cursor: "pointer" }}>
              {language === "en" ? "← Back to site" : "← На сайт"}
            </button>
          </div>
          {currentView === "countries" && <CountriesAdmin onChanged={loadData} />}
        </>

      /* ── People page (public, with admin edit rights) ── */
      ) : currentView === "people" ? (
        <PeoplePage
          people={people}
          mugs={mugs}
          countries={countries}
          language={language}
          isAdmin={isAdminAuthenticated}
          onRefresh={loadData}
        />

      ) : (
        <>
          {warningMessage && (
            <div style={{ padding: "10px 24px", background: "#fff8ea", borderBottom: "1px solid #f3d5a3", color: "#7a4b00", fontSize: 13 }}>{warningMessage}</div>
          )}

          {/* ── Hero ── */}
          <section style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 3fr)",
            background: "#fff",
            borderBottom: "0.5px solid #e8e2d9",
          }}>

            {/* Left — info panel */}
            <div style={{
              display: "flex", flexDirection: "column", minWidth: 0,
              borderRight: isMobile ? "none" : "0.5px solid #e8e2d9",
              borderBottom: isMobile ? "0.5px solid #e8e2d9" : "none",
            }}>

              {/* Padded text + stats (desktop) + admin pills */}
              <div style={{
                padding: isMobile ? "24px 20px 16px" : "40px 32px 40px 28px",
                display: "flex", flexDirection: "column", gap: isMobile ? 16 : 24,
              }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#1f6f54", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                    {h.eyebrow}
                  </p>
                  <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "#153126", lineHeight: 1.3, marginBottom: 14, whiteSpace: "pre-line" }}>
                    {h.title(getCollectionYears(), countriesWithMugsCount)}
                  </h1>
                  <p style={{ fontSize: 13, color: "#5f6f66", lineHeight: 1.7 }}>
                    {h.text}
                  </p>
                </div>

                {/* Desktop stats only */}
                {!isMobile && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                    <div style={{ padding: "12px 14px", borderRadius: 12, background: "#f5f0e8", border: "0.5px solid #e8e2d9" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontSize: 32, fontWeight: 700, color: "#153126", lineHeight: 1 }}>{mugs.length}</span>
                        <span style={{ fontSize: 13, color: "#5f6f66" }}>{h.stat1label}</span>
                      </div>
                    </div>

                    <div style={{ padding: "12px 14px", borderRadius: 12, background: "#f5f0e8", border: "0.5px solid #e8e2d9" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 32, fontWeight: 700, color: "#1f6f54", lineHeight: 1 }}>{countriesWithMugsCount}</span>
                        <span style={{ fontSize: 13, color: "#5f6f66" }}>{h.stat2label(countriesWithMugsCount, countriesWithStarbucksCount)}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 999, background: "#e8e2d9", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 999, background: "#1f6f54",
                          width: `${Math.round((countriesWithMugsCount / Math.max(countriesWithStarbucksCount, 1)) * 100)}%`,
                          transition: "width 0.6s ease",
                        }} />
                      </div>
                      <div style={{ marginTop: 5, fontSize: 11, color: "#8a9e96" }}>
                        {h.stat2sub(countriesWithStarbucksCount - countriesWithMugsCount)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentView("people")}
                      style={{
                        padding: "12px 14px", borderRadius: 12, background: "#f5f0e8", border: "0.5px solid #e8e2d9",
                        textAlign: "left", cursor: "pointer", width: "100%",
                        transition: "background 0.15s, border-color 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#e8f5ee"; e.currentTarget.style.borderColor = "#1f6f54"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#f5f0e8"; e.currentTarget.style.borderColor = "#e8e2d9"; }}
                    >
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 32, fontWeight: 700, color: "#153126", lineHeight: 1 }}>{visibleFriendsCount}</span>
                        <span style={{ fontSize: 13, color: "#5f6f66" }}>{h.stat3label}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, color: "#8a9e96" }}>{h.stat3sub}</span>
                        <span style={{ fontSize: 11, color: "#1f6f54", fontWeight: 600 }}>
                          {language === "en" ? "View →" : "Смотреть →"}
                        </span>
                      </div>
                    </button>
                  </div>
                )}

                {/* Admin pill — countries only (People is now public nav) */}
                {isAdminAuthenticated && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => openAdminView("countries")} style={{
                      padding: "5px 12px", border: "0.5px solid #1f6f54", borderRadius: 999,
                      background: "transparent", color: "#1f6f54", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}>
                      {language === "en" ? "Countries" : "Страны"}
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile stats bar — outside padded wrapper so overflowX: auto works correctly */}
              {isMobile && (
                <MobileStatsBar
                  mugsCount={mugs.length}
                  countriesWithMugsCount={countriesWithMugsCount}
                  countriesWithStarbucksCount={countriesWithStarbucksCount}
                  visibleFriendsCount={visibleFriendsCount}
                  h={h}
                  onPeopleClick={() => setCurrentView("people")}
                />
              )}
            </div>

            {/* Right: legend + globe — desktop only */}
            {!isMobile && (
              <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>

                {/* Legend bar */}
                <div style={{
                  display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center",
                  padding: "10px 16px",
                  background: "#faf7f3", borderBottom: "0.5px solid #e8e2d9",
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#8a9e96", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {h.legendTitle}
                  </span>
                  {[
                    { color: "#E8E1D7", border: "0.5px solid #ccc", label: h.l1 },
                    { color: "#B7D7C2", label: h.l2 },
                    { color: "#2F7D57", label: h.l3 },
                  ].map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#5f6f66" }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.color, border: item.border || "none", flexShrink: 0 }} />
                      {item.label}
                    </div>
                  ))}
                </div>

                {/* Globe */}
                <div style={{ position: "relative", flex: 1, minHeight: 380, overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: 0 }}>
                    <GlobeMapAsync
                      countryData={globeCountryData}
                      selectedCountryCode={selectedRegionCode}
                      selectedRegionCode={selectedRegionCode}
                      hoveredCountryCode={selectedRegionCode ? "" : hoveredRegionCode}
                      hoveredRegionCode={selectedRegionCode ? "" : hoveredRegionCode}
                      onCountryHover={handleCountryHover}
                      onCountryClick={handleCountryClick}
                      isActive={true}
                      language={language}
                    />
                  </div>

                  {!selectedRegionCode && (
                    <div style={{
                      position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)",
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "5px 12px", borderRadius: 999,
                      background: "rgba(255,255,255,0.88)",
                      fontSize: 12, color: "#5f6f66", whiteSpace: "nowrap", pointerEvents: "none",
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#1f6f54" }} />
                      {h.hint}
                    </div>
                  )}

                  {selectedRegionCode && panelCountryRecord && (
                    <div style={{
                      position: "absolute", top: 14, left: 14,
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 14px", borderRadius: 12,
                      background: "rgba(255,255,255,0.92)",
                      border: "0.5px solid #e8e2d9",
                      fontSize: 13, color: "#153126", fontWeight: 600,
                    }}>
                      {getCountryDisplayName(panelCountryRecord)}
                      <span style={{ color: "#1f6f54", fontWeight: 700 }}>
                        {panelMugs.length} {h.mugsLabel}
                      </span>
                      <button type="button" onClick={clearSelection} style={{ background: "none", border: "none", fontSize: 16, color: "#9ca3af", cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ── People teaser ── */}
          <PeopleTeaser
            people={people}
            mugs={mugs}
            language={language}
            onClick={() => setCurrentView("people")}
          />

          {/* ── Catalog ── */}
          <div id="catalog-section">
            <CatalogPage
              mugs={mugs}
              countries={countries}
              states={states}
              cities={cities}
              people={people}
              selectedCountryIso={selectedCountryIso}
              selectedStateCode={selectedStateCode}
              selectedCountryLabel={panelCountryRecord ? getCountryDisplayName(panelCountryRecord) : ""}
              language={language}
              isAdmin={isAdminAuthenticated}
              onMugChanged={updateMug}
              onMugDeleted={removeMug}
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
