import { lazy, Suspense, useMemo, useState } from "react";
import FlatMap from "./FlatMap"; // <- замени на свой текущий 2D-компонент

const GlobeMap = lazy(() => import("./GlobeMap"));

function MapViewSwitcher(props) {
  const [viewMode, setViewMode] = useState("flat");

  const sharedProps = useMemo(
    () => ({
      countriesByIso: props.countriesByIso,
      mugCountByCountryId: props.mugCountByCountryId,
      selectedCountryIso: props.selectedCountryIso,
      hoveredCountryIso: props.hoveredCountryIso,
      onCountryHover: props.onCountryHover,
      onCountryClick: props.onCountryClick,
    }),
    [
      props.countriesByIso,
      props.mugCountByCountryId,
      props.selectedCountryIso,
      props.hoveredCountryIso,
      props.onCountryHover,
      props.onCountryClick,
    ]
  );

  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => setViewMode("flat")}
          style={{
            border: "1px solid #d5ddd7",
            background: viewMode === "flat" ? "#006241" : "#ffffff",
            color: viewMode === "flat" ? "#ffffff" : "#23402f",
            padding: "8px 14px",
            borderRadius: 999,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          2D карта
        </button>

        <button
          type="button"
          onClick={() => setViewMode("globe")}
          style={{
            border: "1px solid #d5ddd7",
            background: viewMode === "globe" ? "#006241" : "#ffffff",
            color: viewMode === "globe" ? "#ffffff" : "#23402f",
            padding: "8px 14px",
            borderRadius: 999,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          3D глобус
        </button>

        {viewMode === "globe" && (
          <span
            style={{
              fontSize: 13,
              color: "#5c6f62",
            }}
          >
            3D-режим тяжелее и загружается отдельно
          </span>
        )}
      </div>

      {viewMode === "flat" ? (
        <FlatMap {...sharedProps} />
      ) : (
        <Suspense
          fallback={
            <div
              style={{
                minHeight: 520,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #e2e8e3",
                borderRadius: 20,
                background: "#f8fbf9",
                color: "#45604e",
                fontWeight: 600,
              }}
            >
              Загружаем 3D-глобус…
            </div>
          }
        >
          <GlobeMap {...sharedProps} />
        </Suspense>
      )}
    </section>
  );
}

export default MapViewSwitcher;