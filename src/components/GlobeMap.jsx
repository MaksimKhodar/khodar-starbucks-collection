import React, {
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

const GEOJSON_SOURCES = [
  "/data/ne_110m_admin_0_countries.geojson",
  "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_0_countries.geojson",
];

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[’']/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-zа-яё0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getFeatureCode(feature) {
  const p = feature?.properties || {};

  const iso2 =
    p.ISO_A2 ||
    p.iso_a2 ||
    p.WB_A2 ||
    p.iso2 ||
    p.ISO2 ||
    feature?.id;

  if (iso2 && String(iso2).length === 2) {
    return normalizeCode(iso2);
  }

  return "";
}

function getFeatureName(feature) {
  const p = feature?.properties || {};

  return (
    p.ADMIN ||
    p.NAME ||
    p.NAME_LONG ||
    p.BRK_NAME ||
    p.FORMAL_EN ||
    p.NAME_EN ||
    p.SOVEREIGNT ||
    p.name ||
    "Unknown country"
  );
}

async function loadWorldGeoJson() {
  let lastError = null;

  for (const url of GEOJSON_SOURCES) {
    try {
      const response = await fetch(url, { cache: "force-cache" });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json();

      if (json?.features?.length) {
        return json;
      }

      throw new Error("GeoJSON is empty");
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Не удалось загрузить GeoJSON мира");
}

function buildCountryIndexes(countryData) {
  const byCode = new Map();
  const byName = new Map();

  (countryData || []).forEach((item) => {
    const code = normalizeCode(item.code);
    const names = [
      item.name,
      item.nameEn,
      item.nameRu,
      item.label,
      item.countryName,
    ]
      .filter(Boolean)
      .map(normalizeName);

    if (code) {
      byCode.set(code, item);
    }

    names.forEach((name) => {
      if (name) {
        byName.set(name, item);
      }
    });
  });

  return { byCode, byName };
}

function resolveCountryRecord(feature, indexes) {
  const code = getFeatureCode(feature);
  const name = getFeatureName(feature);

  if (code && indexes.byCode.has(code)) {
    return indexes.byCode.get(code);
  }

  const normalizedName = normalizeName(name);

  if (normalizedName && indexes.byName.has(normalizedName)) {
    return indexes.byName.get(normalizedName);
  }

  return null;
}

function getCountryState(record) {
  if (!record) {
    return {
      hasStarbucks: false,
      mugsCount: 0,
      hasMugs: false,
    };
  }

  const mugsCount = Number(record.mugsCount ?? record.mugs ?? 0);
  const hasMugs = mugsCount > 0;
  const hasStarbucks = !!record.hasStarbucks;

  return {
    hasStarbucks,
    mugsCount,
    hasMugs,
  };
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
  const containerRef = useRef(null);
  const globeRef = useRef(null);

  const [size, setSize] = useState({ width: 1000, height: 700 });
  const [worldGeoJson, setWorldGeoJson] = useState(null);
  const [geoError, setGeoError] = useState("");
  const [geoLoaded, setGeoLoaded] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const [statusText, setStatusText] = useState("Подгружаем карту стран…");

  const countryIndexes = useMemo(
    () => buildCountryIndexes(countryData),
    [countryData]
  );

  const polygonsData = useMemo(() => {
    return worldGeoJson?.features ?? [];
  }, [worldGeoJson]);

  const globeMaterial = useMemo(() => {
    const material = new THREE.MeshPhongMaterial({
      color: COLORS.globe,
      shininess: 0.2,
    });
    return material;
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const element = containerRef.current;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();

      setSize({
        width: Math.max(320, Math.round(rect.width || 1000)),
        height: Math.max(420, Math.round(rect.height || 700)),
      });
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    setGeoLoaded(false);
    setGeoError("");
    setStatusText("Подгружаем карту стран…");
    setShowLoader(true);

    loadWorldGeoJson()
      .then((json) => {
        if (cancelled) return;
        setWorldGeoJson(json);
        setGeoLoaded(true);
        setStatusText("Подготавливаем глобус…");
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Ошибка загрузки GeoJSON:", error);
        setGeoError(
          "Не удалось загрузить границы стран для 3D-глобуса. Проверьте сеть или путь к GeoJSON."
        );
        setShowLoader(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (geoError) return;
    if (!geoLoaded || !globeReady) return;

    setStatusText("Почти готово…");

    let raf1 = 0;
    let raf2 = 0;
    let timer = 0;

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        timer = window.setTimeout(() => {
          setShowLoader(false);
        }, 250);
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(timer);
    };
  }, [geoLoaded, globeReady, geoError]);

  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
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

    globe.pointOfView(
      {
        lat: 18,
        lng: 15,
        altitude: 1.9,
      },
      0
    );

    setGlobeReady(true);
  }, []);

  const polygonCapColor = useCallback(
    (feature) => {
      const record = resolveCountryRecord(feature, countryIndexes);
      const resolvedCode = normalizeCode(
        record?.code || getFeatureCode(feature) || ""
      );

      if (
        resolvedCode &&
        resolvedCode === normalizeCode(selectedCountryCode || "")
      ) {
        return COLORS.selected;
      }

      const { hasStarbucks, hasMugs } = getCountryState(record);

      if (hasMugs) return COLORS.mugs;
      if (hasStarbucks) return COLORS.starbucksOnly;
      return COLORS.empty;
    },
    [countryIndexes, selectedCountryCode]
  );

  const polygonSideColor = useCallback(() => COLORS.side, []);
  const polygonStrokeColor = useCallback(() => COLORS.stroke, []);

  const polygonAltitude = useCallback(
    (feature) => {
      const record = resolveCountryRecord(feature, countryIndexes);
      const resolvedCode = normalizeCode(
        record?.code || getFeatureCode(feature) || ""
      );

      if (
        resolvedCode &&
        resolvedCode === normalizeCode(selectedCountryCode || "")
      ) {
        return 0.03;
      }

      if (
        resolvedCode &&
        resolvedCode === normalizeCode(hoveredCountryCode || "")
      ) {
        return 0.016;
      }

      return 0.008;
    },
    [countryIndexes, selectedCountryCode, hoveredCountryCode]
  );

  const polygonLabel = useCallback(
    (feature) => {
      const record = resolveCountryRecord(feature, countryIndexes);
      const fallbackName = getFeatureName(feature);
      const name =
        record?.nameRu || record?.name || record?.nameEn || fallbackName;
      const code = record?.code || getFeatureCode(feature) || "—";
      const { hasStarbucks, mugsCount } = getCountryState(record);

      return `
        <div style="padding:8px 10px;background:#ffffff;border-radius:10px;color:#1f2937;box-shadow:0 8px 24px rgba(0,0,0,0.12);font-size:13px;line-height:1.45;">
          <div style="font-weight:700;margin-bottom:4px;">${name}</div>
          <div>ISO: ${code}</div>
          <div>Starbucks: ${hasStarbucks ? "есть" : "нет"}</div>
          <div>Кружек: ${mugsCount}</div>
        </div>
      `;
    },
    [countryIndexes]
  );

  const handlePolygonHover = useCallback(
    (feature) => {
      if (!onCountryHover) return;

      if (!feature) {
        onCountryHover("", "");
        return;
      }

      const record = resolveCountryRecord(feature, countryIndexes);
      const code = normalizeCode(record?.code || getFeatureCode(feature) || "");
      const name =
        record?.nameRu ||
        record?.name ||
        record?.nameEn ||
        getFeatureName(feature);

      onCountryHover({
        code,
        name,
      });
    },
    [countryIndexes, onCountryHover]
  );

  const handlePolygonClick = useCallback(
    (feature) => {
      if (!onCountryClick || !feature) return;

      const record = resolveCountryRecord(feature, countryIndexes);
      const code = normalizeCode(record?.code || getFeatureCode(feature) || "");
      const name =
        record?.nameRu ||
        record?.name ||
        record?.nameEn ||
        getFeatureName(feature);

      onCountryClick({
        code,
        name,
      });
    },
    [countryIndexes, onCountryClick]
  );

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
        background:
          "radial-gradient(circle at center, #f7f2ea 0%, #efe7dc 100%)",
        borderRadius: "24px",
      }}
    >
      {!geoError && (
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
          }}
          globeMaterial={globeMaterial}
          onGlobeReady={handleGlobeReady}
          showGlobe={true}
          showAtmosphere={false}
          showGraticules={false}
          polygonsData={polygonsData}
          polygonCapColor={polygonCapColor}
          polygonSideColor={polygonSideColor}
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
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "radial-gradient(circle at center, #f7f2ea 0%, #efe7dc 100%)",
            zIndex: 5,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              color: "#244c3a",
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                border: "3px solid rgba(36,76,58,0.18)",
                borderTopColor: "#244c3a",
                animation: "globe-spin 0.9s linear infinite",
              }}
            />
            <div>{statusText}</div>
          </div>
        </div>
      )}

      {geoError && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            textAlign: "center",
            color: "#6b4f3a",
            background:
              "radial-gradient(circle at center, #f7f2ea 0%, #efe7dc 100%)",
            zIndex: 6,
          }}
        >
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
              Не удалось показать глобус
            </div>
            <div style={{ maxWidth: 520, lineHeight: 1.5 }}>{geoError}</div>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes globe-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

export default memo(GlobeMap);