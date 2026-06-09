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
import PersonModal from "./components/PersonModal";

import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import { normalizeIso2, getCollectionYears, ruYears, ruCountries, personSlug } from "./lib/utils";

// ─── URL routing helpers ──────────────────────────────────────────────────────

function pushUrl(path) { window.history.pushState({}, "", path); }

const ADMIN_TOKEN_STORAGE_KEY = "khodar_admin_token";
const ADMIN_ONLY_VIEWS = new Set(["countries"]);
const MOBILE_BREAKPOINT = 768;

// ─── Data cache (localStorage, 30 min TTL) ────────────────────────────────────

const CACHE_KEY = "sb_main_v1";
const CACHE_TTL = 30 * 60 * 1000;

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(CACHE_KEY); return null; }
    return data;
  } catch { return null; }
}

function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

function clearCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

// ─── Hero text ────────────────────────────────────────────────────────────────

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
  const cardStyle = {
    minWidth: 0,
    padding: "11px 10px",
    background: "#fff",
    borderRadius: 14,
    border: "0.5px solid #e8e2d9",
    boxShadow: "0 8px 22px rgba(31, 41, 55, 0.04)",
  };
  const valueStyle = { fontSize: 24, fontWeight: 700, color: "#153126", lineHeight: 1 };
  const labelStyle = { fontSize: 10.5, color: "#5f6f66", lineHeight: 1.25, marginTop: 5 };

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: 8, padding: "12px 14px 14px",
      background: "#faf7f3", borderTop: "0.5px solid #e8e2d9",
    }}>
      <div style={cardStyle}>
        <div style={valueStyle}>{mugsCount}</div>
        <div style={labelStyle}>{h.stat1label}</div>
      </div>
      <div style={cardStyle}>
        <div style={{ ...valueStyle, color: "#1f6f54" }}>{countriesWithMugsCount}</div>
        <div style={labelStyle}>{h.stat2label(countriesWithMugsCount, countriesWithStarbucksCount)}</div>
      </div>
      <button
        type="button"
        onClick={onPeopleClick}
        style={{
          ...cardStyle,
          textAlign: "left",
          cursor: "pointer",
          appearance: "none",
          fontFamily: "inherit",
        }}
      >
        <div style={valueStyle}>{visibleFriendsCount}</div>
        <div style={{ ...labelStyle, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 4 }}>
          <span>{h.stat3label}</span>
          <span style={{ color: "#1f6f54", fontWeight: 800, fontSize: 12, lineHeight: 1 }}>→</span>
        </div>
      </button>
    </div>
  );
}

// ─── PeopleTeaser ─────────────────────────────────────────────────────────────

function PeopleTeaser({ people = [], mugs = [], language, isMobile = false, onClick }) {
  const topPeople = useMemo(() => {
    const counts = {};
    mugs.forEach(m => {
      const ids = Array.isArray(m.brought_by_person_ids) ? m.brought_by_person_ids
        : m.brought_by_person_id ? [m.brought_by_person_id] : [];
      ids.forEach(id => { if (id) counts[id] = (counts[id] || 0) + 1; });
    });
    return [...people]
      .filter(p => p.is_visible !== false && !p.is_owner)
      .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0))
      .slice(0, isMobile ? 4 : 7);
  }, [people, mugs, isMobile]);

  const visibleCount = people.filter(p => p.is_visible !== false).length;
  const avatarSize = isMobile ? 34 : 40;
  const overlap    = isMobile ? 8  : 10;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center",
        width: "100%", padding: isMobile ? "12px 16px" : "18px 24px",
        background: "linear-gradient(to right, #f0faf5, #faf7f3)",
        border: "none", borderBottom: "0.5px solid #e8e2d9",
        cursor: "pointer", textAlign: "left",
        gap: isMobile ? 12 : 20,
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
              width: avatarSize, height: avatarSize, borderRadius: "50%",
              border: "2.5px solid #fff",
              marginLeft: i === 0 ? 0 : -overlap,
              background: url ? `url(${url}) center/cover` : "linear-gradient(135deg,#1f6f54,#2d9970)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: isMobile ? 11 : 13, fontWeight: 700,
              flexShrink: 0, zIndex: topPeople.length - i,
              boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
            }}>
              {!url && initials}
            </div>
          );
        })}
        {visibleCount > topPeople.length && (
          <div style={{
            width: avatarSize, height: avatarSize, borderRadius: "50%",
            border: "2.5px solid #fff", marginLeft: -overlap,
            background: "#e8f5ee",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#1f6f54", fontSize: 10, fontWeight: 700,
            flexShrink: 0, zIndex: 0,
          }}>
            +{visibleCount - topPeople.length}
          </div>
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <div style={{
          fontSize: isMobile ? 13 : 14, fontWeight: 700, color: "#153126",
          marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {language === "en" ? "People behind the mugs" : "Люди за кружками"}
        </div>
        {!isMobile && (
          <div style={{ fontSize: 12, color: "#5f6f66" }}>
            {language === "en"
              ? `${visibleCount} contributors helped build this collection`
              : `${visibleCount} участников помогли собрать эту коллекцию`}
          </div>
        )}
        {isMobile && (
          <div style={{ fontSize: 11, color: "#5f6f66" }}>
            {visibleCount} {language === "en" ? "contributors" : "участников"} →
          </div>
        )}
      </div>

      {/* Arrow — desktop only */}
      {!isMobile && (
        <div style={{
          flexShrink: 0, width: 32, height: 32, borderRadius: "50%",
          background: "#1f6f54", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 700,
        }}>→</div>
      )}
    </button>
  );
}

// ─── QR Modal ────────────────────────────────────────────────────────────────

function QRModal({ onClose }) {
  const url = "https://khodar-starbucks-collection.vercel.app";
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}&color=153126&bgcolor=fffaf4`;
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,30,20,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fffaf4", borderRadius: 20, padding: "28px 32px 24px", textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#153126", marginBottom: 4 }}>Khodar Starbucks Collection</div>
        <div style={{ fontSize: 12, color: "#8a9e96", marginBottom: 16 }}>{url}</div>
        <img src={qrSrc} alt="QR code" width={220} height={220} style={{ borderRadius: 12 }} />
        <div style={{ marginTop: 14, fontSize: 12, color: "#5f6f66" }}>Отсканируй камерой телефона</div>
        <button type="button" onClick={onClose} style={{ marginTop: 16, padding: "8px 24px", border: "none", borderRadius: 10, background: "#1f6f54", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Закрыть</button>
      </div>
    </div>
  );
}

// ─── MugDeepLinkModal ────────────────────────────────────────────────────────

function MugDeepLinkModal({ mug, countryName, language, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  const images = mug.mug_images || [];
  const [idx, setIdx] = useState(0);
  const img = images[idx];
  const imgUrl = img ? getMugImageUrl(img.storage_path) : null;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 600,
      background: "rgba(15,30,20,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, animation: "modalBgIn 0.2s ease",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fffaf4", borderRadius: 20,
        width: "100%", maxWidth: 480,
        boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
        animation: "modalIn 0.22s ease", overflow: "hidden",
      }}>
        {/* Image */}
        <div style={{ position: "relative", aspectRatio: "1/1", background: "#f5f0e8" }}>
          {imgUrl
            ? <img src={imgUrl} alt={mug.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc", fontSize: 48 }}>☕</div>
          }
          {images.length > 1 && (
            <>
              <button type="button" onClick={() => setIdx(i => Math.max(0, i-1))} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", fontSize: 18 }}>‹</button>
              <button type="button" onClick={() => setIdx(i => Math.min(images.length-1, i+1))} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", fontSize: 18 }}>›</button>
              <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.5)", color: "#fff", borderRadius: 999, padding: "3px 10px", fontSize: 11 }}>
                {idx+1}/{images.length}
              </div>
            </>
          )}
          <button type="button" onClick={onClose} style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
        {/* Info */}
        <div style={{ padding: "16px 20px 20px" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#153126", marginBottom: 4 }}>{mug.title}</div>
          <div style={{ fontSize: 12, color: "#8a9e96" }}>
            #{mug.collection_number}{countryName ? ` · ${countryName}` : ""}
            {mug.received_at ? ` · ${String(mug.received_at).slice(0,7)}` : ""}
          </div>
          {mug.note && (
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "#5f6f66", lineHeight: 1.6 }}>{mug.note}</p>
          )}
          {/* Share link */}
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <input readOnly value={window.location.href} style={{ flex: 1, padding: "7px 10px", border: "1px solid #e2ddd4", borderRadius: 8, fontSize: 12, color: "#5f6f66", background: "#faf7f3" }} />
            <button type="button" onClick={() => navigator.clipboard?.writeText(window.location.href)} style={{ padding: "7px 12px", border: "none", borderRadius: 8, background: "#1f6f54", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              {language === "en" ? "Copy link" : "Копировать"}
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes modalBgIn { from { opacity:0; } to { opacity:1; } }
        @keyframes modalIn { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
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
  const [showQR, setShowQR] = useState(false);

  // Deep-link modal state
  const [deepLinkMugId, setDeepLinkMugId]       = useState(null);
  const [deepLinkPersonId, setDeepLinkPersonId] = useState(null);

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

  function applyToState({ countries, mugs, people, cities, states }) {
    setCountries(countries ?? []);
    setMugs(mugs ?? []);
    setPeople((people ?? []).map(p => ({ ...p, is_visible: p.is_visible ?? true, is_owner: p.is_owner ?? false })));
    setCities(cities ?? []);
    setStates(states ?? []);
  }

  // applyData — shared setter used by both loadData and refreshData
  const applyData = useCallback(async (showLoading) => {
    if (showLoading) {
      const cached = readCache();
      if (cached) {
        applyToState(cached);
        setLoading(false);
        return;
      }
      setLoading(true); setFatalError(""); setWarningMessage("");
    }
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
        () => supabase.from("people").select("id, first_name, last_name, bio, avatar_image_path, instagram_url, is_visible, is_owner").eq("is_visible", true).order("first_name", { ascending: true }),
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

    if (showLoading && (countriesRes.error || mugsRes.error)) {
      setFatalError(countriesRes.error?.message || mugsRes.error?.message || "Не удалось загрузить данные.");
      setCountries([]); setStates([]); setMugs([]); setPeople([]); setCities([]);
      setLoading(false); return;
    }
    const newCountries = !countriesRes.error ? (countriesRes.data ?? []) : null;
    const newMugs      = !mugsRes.error      ? (mugsRes.data ?? [])      : null;
    const newPeople    = !peopleRes.error     ? (peopleRes.data ?? [])    : null;
    const newCities    = !citiesRes.error     ? (citiesRes.data ?? [])    : null;
    const newStates    = !statesRes.error     ? (statesRes.data ?? [])    : null;

    applyToState({
      countries: newCountries, mugs: newMugs, people: newPeople,
      cities: newCities, states: newStates,
    });

    if (newCountries && newMugs && newPeople && newCities && newStates) {
      writeCache({ countries: newCountries, mugs: newMugs, people: newPeople, cities: newCities, states: newStates });
    }

    const warnings = [
      peopleRes.error ? `People: ${peopleRes.error.message}` : null,
      citiesRes.error ? `Cities: ${citiesRes.error.message}` : null,
      statesRes.error ? `States: ${statesRes.error.message}` : null,
    ].filter(Boolean);
    if (showLoading) { setWarningMessage(warnings.join(" / ")); setLoading(false); }
  }, [tryLoadTable]);

  const loadData    = useCallback(() => applyData(true),  [applyData]);
  const refreshData = useCallback(() => { clearCache(); return applyData(false); }, [applyData]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try { await loadData(); }
      catch (err) { if (!cancelled) { setFatalError(err?.message || "Ошибка загрузки."); setLoading(false); } }
    }
    run();
    return () => { cancelled = true; };
  }, [loadData]);

  // ── Deep-link URL parsing (runs once after data is loaded) ───────────────────

  useEffect(() => {
    if (loading) return;
    const path = window.location.pathname;
    const mugMatch    = path.match(/^\/mug\/(\d+)$/);
    const personMatch = path.match(/^\/people\/(.+)$/);
    if (mugMatch) {
      const num = Number(mugMatch[1]);
      const mug = mugs.find(m => Number(m.collection_number) === num);
      if (mug) setDeepLinkMugId(mug.id);
    } else if (personMatch) {
      const slug = personMatch[1];
      const person = people.find(p => personSlug(p) === slug);
      if (person) setDeepLinkPersonId(person.id);
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Redirect mobile non-admins away from people page
  useEffect(() => {
    if (isMobile && !isAdminAuthenticated && currentView === "people") setCurrentView("home");
  }, [isMobile, isAdminAuthenticated, currentView]);

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

      {/* ── Deep-link modals (opened via /mug/:id or /people/:slug) ── */}
      {deepLinkMugId && (() => {
        const mug = mugs.find(m => m.id === deepLinkMugId);
        if (!mug) return null;
        const country = countriesById.get(String(mug.country_id || ""));
        return (
          <MugDeepLinkModal
            mug={mug}
            countryName={country ? getCountryDisplayName(country) : null}
            language={language}
            onClose={() => { setDeepLinkMugId(null); pushUrl("/"); }}
          />
        );
      })()}
      {deepLinkPersonId && (() => {
        const person = people.find(p => p.id === deepLinkPersonId);
        if (!person) return null;
        const mugCount = mugs.filter(m => {
          const ids = Array.isArray(m.brought_by_person_ids) ? m.brought_by_person_ids : m.brought_by_person_id ? [m.brought_by_person_id] : [];
          return ids.includes(person.id);
        }).length;
        return (
          <PersonModal
            person={{ ...person, mugsCount: mugCount }}
            mugs={mugs}
            countries={countries}
            language={language}
            isAdmin={isAdminAuthenticated}
            onClose={() => { setDeepLinkPersonId(null); pushUrl("/"); }}
            onRefresh={refreshData}
          />
        );
      })()}

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
          {!isMobile && (
            <button type="button" onClick={() => setShowQR(true)} title="QR-код сайта"
              style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", lineHeight: 1, padding: "4px 2px", display: "flex", alignItems: "center" }}
              onMouseEnter={e => { e.currentTarget.style.color = "#1f6f54"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "#9ca3af"; }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                {/* Top-left finder */}
                <rect x="0" y="0" width="8" height="1.2"/>
                <rect x="0" y="6.8" width="8" height="1.2"/>
                <rect x="0" y="0" width="1.2" height="8"/>
                <rect x="6.8" y="0" width="1.2" height="8"/>
                <rect x="2.5" y="2.5" width="3" height="3"/>
                {/* Top-right finder */}
                <rect x="12" y="0" width="8" height="1.2"/>
                <rect x="12" y="6.8" width="8" height="1.2"/>
                <rect x="12" y="0" width="1.2" height="8"/>
                <rect x="18.8" y="0" width="1.2" height="8"/>
                <rect x="14.5" y="2.5" width="3" height="3"/>
                {/* Bottom-left finder */}
                <rect x="0" y="12" width="8" height="1.2"/>
                <rect x="0" y="18.8" width="8" height="1.2"/>
                <rect x="0" y="12" width="1.2" height="8"/>
                <rect x="6.8" y="12" width="1.2" height="8"/>
                <rect x="2.5" y="14.5" width="3" height="3"/>
                {/* Data modules */}
                <rect x="10" y="10" width="2" height="2"/>
                <rect x="13" y="10" width="2" height="2"/>
                <rect x="16" y="10" width="2" height="2"/>
                <rect x="10" y="13" width="2" height="2"/>
                <rect x="16" y="13" width="2" height="2"/>
                <rect x="10" y="16" width="2" height="2"/>
                <rect x="13" y="16" width="2" height="2"/>
                <rect x="16" y="16" width="2" height="2"/>
              </svg>
            </button>
          )}
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

      {showQR && <QRModal onClose={() => setShowQR(false)} />}

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
          onRefresh={refreshData}
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
            height: isMobile ? "auto" : "calc(100vh - 52px)",
            background: "#fff",
            borderBottom: "0.5px solid #e8e2d9",
          }}>

            {/* Left — info panel */}
            <div style={{
              display: "flex", flexDirection: "column", minWidth: 0,
              borderRight: isMobile ? "none" : "0.5px solid #e8e2d9",
              borderBottom: isMobile ? "0.5px solid #e8e2d9" : "none",
              overflowY: isMobile ? "visible" : "auto",
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

              {/* Mobile stats bar — compact 3-card grid */}
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

            {/* Mobile map — compact, touch-friendly, and kept inside the viewport */}
            {isMobile && (
              <div style={{
                display: "flex", flexDirection: "column", minWidth: 0,
                background: "#faf7f3", borderTop: "0.5px solid #e8e2d9",
              }}>
                <div style={{
                  display: "flex", gap: 8, alignItems: "center",
                  padding: "10px 14px 8px", overflowX: "auto",
                  WebkitOverflowScrolling: "touch", scrollbarWidth: "none",
                }}>
                  <span style={{
                    flexShrink: 0, fontSize: 10, fontWeight: 800, color: "#8a9e96",
                    textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>
                    {h.legendTitle}
                  </span>
                  {[
                    { color: "#E8E1D7", border: "0.5px solid #ccc", label: h.l1 },
                    { color: "#B7D7C2", label: h.l2 },
                    { color: "#2F7D57", label: h.l3 },
                  ].map((item, i) => (
                    <div key={i} style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "5px 8px", borderRadius: 999, background: "rgba(255,255,255,0.72)",
                      fontSize: 10.5, color: "#5f6f66", whiteSpace: "nowrap", flexShrink: 0,
                    }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: item.color, border: item.border || "none", flexShrink: 0 }} />
                      {item.label}
                    </div>
                  ))}
                </div>

                <div style={{
                  position: "relative", height: "min(84vw, 370px)", minHeight: 300,
                  margin: "0 14px 14px", borderRadius: 22, overflow: "hidden",
                  border: "0.5px solid #e8e2d9", background: "#efe7dc",
                  boxShadow: "0 18px 42px rgba(31, 41, 55, 0.08)",
                }}>
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

                  {!selectedRegionCode && (
                    <div style={{
                      position: "absolute", left: 12, right: 12, bottom: 12,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "7px 10px", borderRadius: 999,
                      background: "rgba(255,255,255,0.9)",
                      fontSize: 11.5, color: "#5f6f66", textAlign: "center", pointerEvents: "none",
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#1f6f54", flexShrink: 0 }} />
                      {h.hint}
                    </div>
                  )}

                  {selectedRegionCode && panelCountryRecord && (
                    <div style={{
                      position: "absolute", top: 12, left: 12, right: 12,
                      display: "flex", alignItems: "center", gap: 7,
                      padding: "8px 10px", borderRadius: 12,
                      background: "rgba(255,255,255,0.94)", border: "0.5px solid #e8e2d9",
                      fontSize: 12, color: "#153126", fontWeight: 700,
                      boxSizing: "border-box", minWidth: 0,
                    }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                        {getCountryDisplayName(panelCountryRecord)}
                      </span>
                      <span style={{ color: "#1f6f54", fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0 }}>
                        {panelMugs.length} {h.mugsLabel}
                      </span>
                      <button type="button" onClick={clearSelection} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 18, color: "#9ca3af", cursor: "pointer", padding: 0, lineHeight: 1, flexShrink: 0 }}>×</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Right: legend + globe — desktop only */}
            {!isMobile && (
              <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>

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
                <div style={{ position: "relative", flex: 1, minHeight: 0, overflow: "hidden" }}>
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

          {/* ── People teaser — visible on desktop and mobile ── */}
          <div id="people-section">
            <PeopleTeaser
              people={people}
              mugs={mugs}
              language={language}
              isMobile={isMobile}
              onClick={() => setCurrentView("people")}
            />
          </div>

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
