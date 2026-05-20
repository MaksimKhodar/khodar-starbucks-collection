import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";

const COLORS = {
  empty: "#E8E1D7",
  starbucksOnly: "#B7D7C2",
  mugs: "#2F7D57",
  selected: "#D9B96E",
  stroke: "rgba(255,255,255,0.95)",
  side: "rgba(0,0,0,0.10)",
  globe: "#EFE7DC",
};

const COUNTRIES_GEOJSON_SOURCES = [
  "/data/ne_110m_admin_0_countries.geojson",
  "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_0_countries.geojson",
];

const US_STATES_GEOJSON_SOURCES = [
  "/maps/ne_110m_admin_1_states_provinces.geojson",
  "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_1_states_provinces.geojson",
];

let worldGeoJsonCache = null;

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase().trim()
    .replace(/&/g, "and").replace(/['']/g, "").replace(/\(.*?\)/g, "")
    .replace(/[^a-zа-яё0-9]+/gi, " ").replace(/\s+/g, " ").trim();
}

function getFeatureCode(feature) {
  const p = feature?.properties || {};
  const postal = p.postal || p.iso_3166_2 || p.code_hasc || "";
  if (feature?._isUsState) {
    if (postal) {
      const code = postal.includes("-") ? postal.split("-")[1] : postal;
      return `US-${normalizeCode(code)}`;
    }
    return "";
  }
  const iso2 = p.ISO_A2 || p.iso_a2 || p.WB_A2 || p.iso2 || p.ISO2 || feature?.id;
  if (iso2 && String(iso2).length === 2) return normalizeCode(iso2);
  return "";
}

function getFeatureName(feature) {
  if (feature?._isUsState) {
    const p = feature?.properties || {};
    return p.name || p.NAME || p.gn_name || "Unknown state";
  }
  const p = feature?.properties || {};
  return p.ADMIN || p.NAME || p.NAME_LONG || p.BRK_NAME ||
    p.FORMAL_EN || p.NAME_EN || p.SOVEREIGNT || p.name || "Unknown country";
}

async function loadGeoJson(sources) {
  let lastError = null;
  for (const url of sources) {
    try {
      const response = await fetch(url, { cache: "force-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      if (json?.features?.length) return json;
      throw new Error("GeoJSON is empty");
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error("Failed to load GeoJSON");
}

async function loadMergedGeoJson() {
  const [countriesJson, statesJson] = await Promise.all([
    loadGeoJson(COUNTRIES_GEOJSON_SOURCES),
    loadGeoJson(US_STATES_GEOJSON_SOURCES).catch(() => null),
  ]);

  const countryFeatures = countriesJson.features.filter((f) => {
    const p = f?.properties || {};
    const iso2 = p.ISO_A2 || p.iso_a2 || p.WB_A2 || p.iso2 || p.ISO2 || f?.id || "";
    return normalizeCode(iso2) !== "US";
  });

  const usStateFeatures = statesJson
    ? statesJson.features
        .filter((f) => {
          const p = f?.properties || {};
          const admin = (p.admin || p.admin0_a3 || "").toUpperCase();
          const hasc = (p.code_hasc || "").toUpperCase();
          return admin === "UNITED STATES OF AMERICA" || hasc.startsWith("US.");
        })
        .map((f) => ({ ...f, _isUsState: true }))
    : [];

  return { type: "FeatureCollection", features: [...countryFeatures, ...usStateFeatures] };
}

function buildCountryIndexes(countryData) {
  const byCode = new Map();
  const byName = new Map();
  (countryData || []).forEach((item) => {
    const code = normalizeCode(item.code || item.iso2_code || item.iso2 || item.country_code || item.regionCode || "");
    const names = [item.name, item.nameEn, item.nameRu, item.label, item.countryName, item.name_en, item.name_ru]
      .filter(Boolean).map(normalizeName);
    if (code) byCode.set(code, item);
    names.forEach((name) => { if (name) byName.set(name, item); });
  });
  return { byCode, byName };
}

function resolveCountryRecord(feature, indexes) {
  const code = getFeatureCode(feature);
  const name = getFeatureName(feature);
  if (feature?._isUsState) return code && indexes.byCode.has(code) ? indexes.byCode.get(code) : null;
  if (code && indexes.byCode.has(code)) return indexes.byCode.get(code);
  const normalizedName = normalizeName(name);
  if (normalizedName && indexes.byName.has(normalizedName)) return indexes.byName.get(normalizedName);
  return null;
}

function getCountryState(record) {
  if (!record) return { hasStarbucks: false, mugsCount: 0, hasMugs: false };
  const mugsCount = Number(record.mugsCount ?? record.mugs ?? 0);
  return { hasStarbucks: !!record.hasStarbucks, mugsCount, hasMugs: mugsCount > 0 };
}

function GlobeMap({
  countryData,
  selectedCountryCode,
  hoveredCountryCode,
  onCountryHover,
  onCountryClick,
  isActive = true,
  className = "",
}) {
  const containerRef   = useRef(null);
  const globeRef       = useRef(null);
  const didInitViewRef = useRef(false);
  const hintTimerRef   = useRef(null);

  const INIT_ALT = 1.9;

  const [size, setSize]           = useState({ width: 0, height: 0 });
  const [worldGeoJson, setWorldGeoJson] = useState(worldGeoJsonCache);
  const [geoError, setGeoError]   = useState("");
  const [showLoader, setShowLoader] = useState(!worldGeoJsonCache);
  const [showCtrlHint, setShowCtrlHint] = useState(false);
  const [globeZoomPct, setGlobeZoomPct] = useState(100);

  const countryIndexes = useMemo(() => buildCountryIndexes(countryData), [countryData]);
  const polygonsData = useMemo(() => worldGeoJson?.features ?? [], [worldGeoJson]);
  const globeMaterial = useMemo(() => new THREE.MeshPhongMaterial({ color: COLORS.globe, shininess: 0.2 }), []);

  useEffect(() => {
    if (!containerRef.current) return;
    const element = containerRef.current;
    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      // Use CSS pixels only — Globe component handles DPR internally via pixelRatio
      const nextWidth = Math.max(320, Math.round(rect.width));
      const nextHeight = Math.max(320, Math.round(rect.height));
      setSize((prev) => {
        if (prev.width === nextWidth && prev.height === nextHeight) return prev;
        return { width: nextWidth, height: nextHeight };
      });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadMergedGeoJson()
      .then((json) => {
        if (cancelled) return;
        worldGeoJsonCache = json;
        setWorldGeoJson(json);
        setShowLoader(false);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("[GlobeMap] GeoJSON load error:", error);
        setGeoError("Не удалось загрузить границы стран для 3D-глобуса. Проверьте файл GeoJSON.");
        setShowLoader(false);
      });
    return () => { cancelled = true; };
  }, []);

  const canRenderGlobe = size.width > 0 && size.height > 0 && polygonsData.length > 0;

  // Block zoom on scroll without Ctrl — let the page scroll instead
  useEffect(() => {
    if (!isActive) return;
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e) {
      if (!e.ctrlKey && !e.metaKey) {
        e.stopPropagation();
        setShowCtrlHint(true);
        clearTimeout(hintTimerRef.current);
        hintTimerRef.current = setTimeout(() => setShowCtrlHint(false), 2000);
      }
    }
    el.addEventListener("wheel", onWheel, { capture: true, passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel, { capture: true });
      clearTimeout(hintTimerRef.current);
    };
  }, [isActive]);

  // Track globe zoom percentage via rAF (cheap — just reads a number)
  useEffect(() => {
    if (!canRenderGlobe) return;
    let frameId;
    let lastPct = 100;
    function tick() {
      try {
        const alt = globeRef.current?.pointOfView?.()?.altitude;
        if (alt) {
          const pct = Math.round((INIT_ALT / alt) * 100);
          if (Math.abs(pct - lastPct) >= 2) { lastPct = pct; setGlobeZoomPct(pct); }
        }
      } catch {}
      frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [canRenderGlobe]);

  const initView = useCallback((globe) => {
    if (!globe) return;
    const controls = globe.controls?.();
    if (controls) {
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.rotateSpeed = 0.85;
      controls.zoomSpeed = 0.95;
      controls.panSpeed = 0.8;
      controls.minDistance = 130;
      controls.maxDistance = 420;
    }
    globe.pointOfView({ lat: 20, lng: 15, altitude: 1.9 }, 0);
  }, []);

  useEffect(() => {
    if (!canRenderGlobe || !globeRef.current || didInitViewRef.current) return;
    const rafId = requestAnimationFrame(() => {
      try {
        initView(globeRef.current);
        didInitViewRef.current = true;
      } catch (error) {
        console.error("[GlobeMap] setup error:", error);
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [canRenderGlobe, initView]);

  const handleGlobeReady = useCallback(() => {
    initView(globeRef.current);
    setShowLoader(false);
  }, [initView]);

  const polygonCapColor = useCallback((feature) => {
    const record = resolveCountryRecord(feature, countryIndexes);
    const resolvedCode = normalizeCode(record?.code || record?.regionCode || record?.iso2_code || getFeatureCode(feature) || "");
    if (resolvedCode && resolvedCode === normalizeCode(selectedCountryCode || "")) return COLORS.selected;
    const { hasStarbucks, hasMugs } = getCountryState(record);
    if (hasMugs) return COLORS.mugs;
    if (hasStarbucks) return COLORS.starbucksOnly;
    return COLORS.empty;
  }, [countryIndexes, selectedCountryCode]);

  const polygonAltitude = useCallback((feature) => {
    const record = resolveCountryRecord(feature, countryIndexes);
    const resolvedCode = normalizeCode(record?.code || record?.regionCode || record?.iso2_code || getFeatureCode(feature) || "");
    if (resolvedCode && resolvedCode === normalizeCode(selectedCountryCode || "")) return 0.03;
    if (resolvedCode && resolvedCode === normalizeCode(hoveredCountryCode || "")) return 0.016;
    return feature?._isUsState ? 0.006 : 0.008;
  }, [countryIndexes, selectedCountryCode, hoveredCountryCode]);

  const polygonLabel = useCallback((feature) => {
    const record = resolveCountryRecord(feature, countryIndexes);
    const fallbackName = getFeatureName(feature);
    const name = record?.nameRu || record?.name_ru || record?.name || record?.nameEn || record?.name_en || fallbackName;
    const code = record?.regionCode || record?.code || record?.iso2_code || getFeatureCode(feature) || "—";
    const { hasStarbucks, mugsCount } = getCountryState(record);
    const isState = feature?._isUsState;
    return `
      <div style="padding:8px 10px;background:#ffffff;border-radius:10px;color:#1f2937;box-shadow:0 8px 24px rgba(0,0,0,0.12);font-size:13px;line-height:1.45;">
        <div style="font-weight:700;margin-bottom:4px;">${name}${isState ? " (США)" : ""}</div>
        <div>${isState ? "Штат" : "ISO"}: ${code}</div>
        <div>Starbucks: ${hasStarbucks ? "есть" : "нет"}</div>
        <div>Кружек: ${mugsCount}</div>
      </div>
    `;
  }, [countryIndexes]);

  const handlePolygonHover = useCallback((feature) => {
    if (!onCountryHover) return;
    if (!feature) { onCountryHover("", ""); return; }
    const record = resolveCountryRecord(feature, countryIndexes);
    const code = normalizeCode(record?.regionCode || record?.code || record?.iso2_code || getFeatureCode(feature) || "");
    const name = record?.nameRu || record?.name_ru || record?.name || record?.nameEn || record?.name_en || getFeatureName(feature);
    onCountryHover({ code, name });
  }, [countryIndexes, onCountryHover]);

  const handlePolygonClick = useCallback((feature) => {
    if (!onCountryClick || !feature) return;
    const record = resolveCountryRecord(feature, countryIndexes);
    const code = normalizeCode(record?.regionCode || record?.code || record?.iso2_code || getFeatureCode(feature) || "");
    const name = record?.nameRu || record?.name_ru || record?.name || record?.nameEn || record?.name_en || getFeatureName(feature);
    onCountryClick({ code, name });
  }, [countryIndexes, onCountryClick]);

  const polygonStrokeColor = useCallback(
    (feature) => feature?._isUsState ? "rgba(255,255,255,0.6)" : COLORS.stroke,
    []
  );

  function globeZoomIn() {
    const alt = globeRef.current?.pointOfView?.()?.altitude;
    if (alt) globeRef.current.pointOfView({ altitude: Math.max(0.28, alt * 0.7) }, 280);
  }
  function globeZoomOut() {
    const alt = globeRef.current?.pointOfView?.()?.altitude;
    if (alt) globeRef.current.pointOfView({ altitude: Math.min(3.8, alt * 1.43) }, 280);
  }
  function globeResetView() {
    globeRef.current?.pointOfView?.({ lat: 20, lng: 15, altitude: INIT_ALT }, 400);
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        opacity: isActive ? 1 : 0,
        pointerEvents: isActive ? "auto" : "none",
        transition: "opacity 220ms ease",
        overflow: "hidden",
        background: "radial-gradient(circle at center, #f7f2ea 0%, #efe7dc 100%)",
      }}
    >
      {!geoError && canRenderGlobe && (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          animateIn={false}
          waitForGlobeReady={true}
          rendererConfig={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            pixelRatio: typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1,
          }}
          globeMaterial={globeMaterial}
          onGlobeReady={handleGlobeReady}
          showGlobe
          showAtmosphere={false}
          showGraticules={false}
          polygonsData={polygonsData}
          polygonCapColor={polygonCapColor}
          polygonSideColor={() => COLORS.side}
          polygonStrokeColor={polygonStrokeColor}
          polygonAltitude={polygonAltitude}
          polygonCapCurvatureResolution={3}
          polygonsTransitionDuration={0}
          polygonLabel={polygonLabel}
          onPolygonHover={handlePolygonHover}
          onPolygonClick={handlePolygonClick}
        />
      )}

      {showLoader && !geoError && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "radial-gradient(circle at center, #f7f2ea 0%, #efe7dc 100%)",
          zIndex: 5,
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "#244c3a", fontWeight: 600, letterSpacing: "0.02em" }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              border: "3px solid rgba(36,76,58,0.18)", borderTopColor: "#244c3a",
              animation: "globe-spin 0.9s linear infinite",
            }} />
            <div>Подгружаем карту…</div>
          </div>
        </div>
      )}

      {geoError && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24, textAlign: "center", color: "#6b4f3a",
          background: "radial-gradient(circle at center, #f7f2ea 0%, #efe7dc 100%)",
          zIndex: 6,
        }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Не удалось показать глобус</div>
            <div style={{ maxWidth: 520, lineHeight: 1.5 }}>{geoError}</div>
          </div>
        </div>
      )}

      {/* Zoom controls + scale */}
      {canRenderGlobe && (
        <div style={{
          position: "absolute", bottom: 14, right: 14, zIndex: 10,
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: "#4a5e54",
            background: "rgba(255,255,255,0.88)", backdropFilter: "blur(6px)",
            padding: "4px 9px", borderRadius: 8, minWidth: 40, textAlign: "center",
            border: "0.5px solid rgba(0,0,0,0.08)",
          }}>{globeZoomPct}%</span>
          {[{ label: "−", fn: globeZoomOut }, { label: "+", fn: globeZoomIn }, { label: "⊙", fn: globeResetView }].map(b => (
            <button key={b.label} type="button" onClick={b.fn} style={{
              width: 30, height: 30, border: "0.5px solid rgba(0,0,0,0.12)", borderRadius: 8,
              background: "rgba(255,255,255,0.88)", backdropFilter: "blur(6px)",
              color: "#2d4a3a", fontSize: b.label === "⊙" ? 14 : 18, fontWeight: 500,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            }}>{b.label}</button>
          ))}
        </div>
      )}

      {/* Ctrl+scroll hint */}
      {showCtrlHint && (
        <div style={{
          position: "absolute", bottom: 60, left: "50%", transform: "translateX(-50%)",
          background: "rgba(21,49,38,0.88)", color: "#fff",
          borderRadius: 10, padding: "8px 16px", fontSize: 12, fontWeight: 500,
          whiteSpace: "nowrap", pointerEvents: "none", zIndex: 20,
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          animation: "hintFadeIn 0.2s ease",
        }}>
          Ctrl + прокрутка для масштабирования
        </div>
      )}

      <style>{`
        @keyframes globe-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes hintFadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(4px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default memo(GlobeMap);
