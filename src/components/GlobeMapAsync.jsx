import { memo, useEffect, useState } from "react";

let GlobeMapModule = null;
let GlobeMapLoaderPromise = null;

function loadGlobeMap() {
  if (GlobeMapModule) {
    return Promise.resolve(GlobeMapModule);
  }

  if (!GlobeMapLoaderPromise) {
    GlobeMapLoaderPromise = import("./GlobeMap").then((module) => {
      GlobeMapModule = module.default;
      return GlobeMapModule;
    });
  }

  return GlobeMapLoaderPromise;
}

function GlobeMapAsync(props) {
  const [LoadedComponent, setLoadedComponent] = useState(() => GlobeMapModule);

  const isActive =
    typeof props.isActive === "boolean"
      ? props.isActive
      : typeof props.isVisible === "boolean"
      ? props.isVisible
      : true;

  useEffect(() => {
    let cancelled = false;

    loadGlobeMap()
      .then((component) => {
        if (!cancelled) {
          setLoadedComponent(() => component);
        }
      })
      .catch((error) => {
        console.error("Не удалось загрузить GlobeMap:", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!LoadedComponent) {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at center, #f7f2ea 0%, #efe7dc 100%)",
          borderRadius: "24px",
          overflow: "hidden",
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
              animation: "globe-async-spin 0.9s linear infinite",
            }}
          />
          <div>Подгружаем модуль глобуса…</div>
        </div>

        <style>
          {`
            @keyframes globe-async-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    );
  }

  return (
    <LoadedComponent
      {...props}
      isActive={isActive}
      selectedCountryCode={
        props.selectedCountryCode ?? props.selectedCountryIso ?? ""
      }
      hoveredCountryCode={
        props.hoveredCountryCode ?? props.hoveredCountryIso ?? ""
      }
    />
  );
}

export default memo(GlobeMapAsync);