import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function normalizeIso2(value) {
  const normalized = (value || "").toUpperCase().trim();

  if (normalized === "UK") return "GB";
  return normalized;
}

function getFeatureIso2(feature) {
  const props = feature?.properties || {};

  const raw =
    props.ISO_A2 ||
    props.iso_a2 ||
    props.iso2 ||
    props["ISO3166-1-Alpha-2"] ||
    props.iso ||
    "";

  const iso2 = normalizeIso2(raw);

  if (iso2 && iso2 !== "-99") {
    return iso2;
  }

  return "";
}

function getFeatureLabel(feature) {
  const props = feature?.properties || {};
  return props.name || props.NAME || props.ADMIN || props.NAME_EN || "";
}

function getGeometryRings(geometry) {
  if (!geometry) return [];

  if (geometry.type === "Polygon") {
    return geometry.coordinates || [];
  }

  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates || []).flatMap((polygon) => polygon || []);
  }

  return [];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function millerProjectRaw(lon, lat) {
  const lambda = (lon * Math.PI) / 180;
  const limitedLat = clamp(lat, -85, 85);
  const phi = (limitedLat * Math.PI) / 180;

  const x = lambda;
  const y = 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * phi));

  return [x, y];
}

function collectProjectedPoints(features) {
  const points = [];

  features.forEach((feature) => {
    const rings = getGeometryRings(feature?.geometry);

    rings.forEach((ring) => {
      ring.forEach((point) => {
        if (
          Array.isArray(point) &&
          point.length >= 2 &&
          Number.isFinite(point[0]) &&
          Number.isFinite(point[1])
        ) {
          points.push(millerProjectRaw(point[0], point[1]));
        }
      });
    });
  });

  return points;
}

function createProjector(features, width, height, padding = 20) {
  const points = collectProjectedPoints(features);

  if (points.length === 0) {
    return {
      project: (lon, lat) => [lon, lat],
      bounds: {
        minX: 0,
        minY: 0,
        maxX: width,
        maxY: height,
        width,
        height,
      },
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  points.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });

  const projectedWidth = Math.max(1, maxX - minX);
  const projectedHeight = Math.max(1, maxY - minY);

  const drawableWidth = Math.max(1, width - padding * 2);
  const drawableHeight = Math.max(1, height - padding * 2);

  const scale = Math.min(
    drawableWidth / projectedWidth,
    drawableHeight / projectedHeight
  );

  const finalWidth = projectedWidth * scale;
  const finalHeight = projectedHeight * scale;

  const offsetX = (width - finalWidth) / 2;
  const offsetY = (height - finalHeight) / 2;

  function project(lon, lat) {
    const [rawX, rawY] = millerProjectRaw(lon, lat);
    const x = offsetX + (rawX - minX) * scale;
    const y = offsetY + (maxY - rawY) * scale;
    return [x, y];
  }

  return {
    project,
    bounds: {
      minX: offsetX,
      minY: offsetY,
      maxX: offsetX + finalWidth,
      maxY: offsetY + finalHeight,
      width: finalWidth,
      height: finalHeight,
    },
  };
}

function buildPathFromGeometry(geometry, project) {
  const rings = getGeometryRings(geometry);

  if (rings.length === 0) {
    return "";
  }

  const parts = [];

  rings.forEach((ring) => {
    if (!Array.isArray(ring) || ring.length === 0) {
      return;
    }

    const commands = ring
      .map((point, index) => {
        if (
          !Array.isArray(point) ||
          point.length < 2 ||
          !Number.isFinite(point[0]) ||
          !Number.isFinite(point[1])
        ) {
          return "";
        }

        const [x, y] = project(point[0], point[1]);
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .filter(Boolean);

    if (commands.length > 0) {
      parts.push(`${commands.join(" ")} Z`);
    }
  });

  return parts.join(" ");
}

function getCountryTarget(target) {
  if (!target || typeof target.closest !== "function") {
    return null;
  }

  const path = target.closest("path[data-country-iso]");
  if (!path) return null;

  return {
    iso: path.getAttribute("data-country-iso") || "",
    label: path.getAttribute("data-country-label") || "",
  };
}

function FlatMap({
  countriesByIso,
  mugCountByCountryId,
  selectedCountryIso,
  hoveredCountryIso,
  onCountryHover,
  onCountryClick,
}) {
  const wrapperRef = useRef(null);
  const svgRef = useRef(null);
  const viewportRef = useRef(null);
  const rafRef = useRef(null);

  const dragRef = useRef({
    isPointerDown: false,
    isDragging: false,
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    startPanX: 0,
    startPanY: 0,
    downCountryIso: "",
    downCountryLabel: "",
  });

  const viewRef = useRef({
    zoom: 1,
    panX: 0,
    panY: 0,
  });

  const [features, setFeatures] = useState([]);
  const [size, setSize] = useState({ width: 1000, height: 560 });

  useEffect(() => {
    let isMounted = true;

    async function loadGeoJson() {
      try {
        const response = await fetch("/maps/ne_110m_admin_0_countries.geojson");
        const geojson = await response.json();

        if (!isMounted) return;
        setFeatures(geojson?.features || []);
      } catch (error) {
        console.error("Failed to load flat map geojson:", error);
      }
    }

    loadGeoJson();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;

    const updateSize = () => {
      const current = wrapperRef.current;
      if (!current) return;

      const width = Math.max(420, Math.floor(current.offsetWidth));
      const height = Math.max(300, Math.floor(width * 0.54));

      setSize((prev) => {
        if (prev.width === width && prev.height === height) {
          return prev;
        }

        return { width, height };
      });
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const projectionData = useMemo(() => {
    return createProjector(features, size.width, size.height, 20);
  }, [features, size.width, size.height]);

  const project = projectionData.project;
  const contentBounds = projectionData.bounds;

  const clampPan = useCallback(
    (nextPan, nextZoom) => {
      if (nextZoom <= 1) {
        return { x: 0, y: 0 };
      }

      const centerX = size.width / 2;
      const centerY = size.height / 2;

      const scaledMinX =
        centerX + (contentBounds.minX - centerX) * nextZoom + nextPan.x;
      const scaledMaxX =
        centerX + (contentBounds.maxX - centerX) * nextZoom + nextPan.x;
      const scaledMinY =
        centerY + (contentBounds.minY - centerY) * nextZoom + nextPan.y;
      const scaledMaxY =
        centerY + (contentBounds.maxY - centerY) * nextZoom + nextPan.y;

      let correctedX = nextPan.x;
      let correctedY = nextPan.y;

      if (scaledMinX > 0) {
        correctedX -= scaledMinX;
      }
      if (scaledMaxX < size.width) {
        correctedX += size.width - scaledMaxX;
      }

      if (scaledMinY > 0) {
        correctedY -= scaledMinY;
      }
      if (scaledMaxY < size.height) {
        correctedY += size.height - scaledMaxY;
      }

      const horizontalOverflow = Math.max(
        0,
        (contentBounds.width * nextZoom - size.width) / 2
      );
      const verticalOverflow = Math.max(
        0,
        (contentBounds.height * nextZoom - size.height) / 2
      );

      correctedX = clamp(
        correctedX,
        -horizontalOverflow - 40,
        horizontalOverflow + 40
      );
      correctedY = clamp(
        correctedY,
        -verticalOverflow - 40,
        verticalOverflow + 40
      );

      return { x: correctedX, y: correctedY };
    },
    [contentBounds, size.width, size.height]
  );

  const applyViewportTransform = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const { zoom, panX, panY } = viewRef.current;

    viewport.setAttribute(
      "transform",
      `translate(${size.width / 2 + panX} ${size.height / 2 + panY}) scale(${zoom}) translate(${-size.width / 2} ${-size.height / 2})`
    );
  }, [size.width, size.height]);

  const scheduleViewportRender = useCallback(() => {
    if (rafRef.current) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      applyViewportTransform();
    });
  }, [applyViewportTransform]);

  const setView = useCallback(
    (nextZoom, nextPan) => {
      viewRef.current = {
        zoom: nextZoom,
        panX: nextPan.x,
        panY: nextPan.y,
      };

      scheduleViewportRender();
    },
    [scheduleViewportRender]
  );

  useEffect(() => {
    applyViewportTransform();
  }, [applyViewportTransform]);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;

    function handleWheelNative(event) {
      const svgElement = svgRef.current;
      if (!svgElement) return;

      event.preventDefault();
      event.stopPropagation();

      const rect = svgElement.getBoundingClientRect();
      const mouseX = ((event.clientX - rect.left) / rect.width) * size.width;
      const mouseY = ((event.clientY - rect.top) / rect.height) * size.height;

      const currentZoom = viewRef.current.zoom;
      const currentPan = {
        x: viewRef.current.panX,
        y: viewRef.current.panY,
      };

      const zoomFactor = event.deltaY < 0 ? 1.12 : 0.9;
      const nextZoom = clamp(currentZoom * zoomFactor, 1, 8);

      if (nextZoom === currentZoom) return;

      const centerX = size.width / 2;
      const centerY = size.height / 2;

      const worldX = (mouseX - centerX - currentPan.x) / currentZoom;
      const worldY = (mouseY - centerY - currentPan.y) / currentZoom;

      const nextPan = clampPan(
        {
          x: mouseX - centerX - worldX * nextZoom,
          y: mouseY - centerY - worldY * nextZoom,
        },
        nextZoom
      );

      setView(nextZoom, nextPan);
    }

    element.addEventListener("wheel", handleWheelNative, { passive: false });

    return () => {
      element.removeEventListener("wheel", handleWheelNative);
    };
  }, [clampPan, setView, size.width, size.height]);

  const mapItems = useMemo(() => {
    return features.map((feature) => {
      const iso2 = getFeatureIso2(feature);
      const label = getFeatureLabel(feature);
      const countryRecord = iso2 ? countriesByIso.get(iso2) : null;
      const mugCount = countryRecord
        ? mugCountByCountryId.get(countryRecord.id) ?? 0
        : 0;

      return {
        feature,
        iso2,
        label,
        countryRecord,
        mugCount,
        path: buildPathFromGeometry(feature?.geometry, project),
      };
    });
  }, [features, countriesByIso, mugCountByCountryId, project]);

  function hasStarbucks(item) {
    return !!item.countryRecord?.has_starbucks_current;
  }

  function hasMugs(item) {
    return item.mugCount > 0;
  }

  function isItemSelected(item) {
    return !!selectedCountryIso && selectedCountryIso === item.iso2;
  }

  function isItemHovered(item) {
    return !!hoveredCountryIso && hoveredCountryIso === item.iso2;
  }

  function getBaseFillColor(item) {
    if (hasMugs(item)) return "#006241";
    if (hasStarbucks(item)) return "#8FD1AB";
    return "#DCE8DF";
  }

  function getActiveFillColor(item) {
    if (hasMugs(item)) return "#004F34";
    if (hasStarbucks(item)) return "#6FBE90";
    return "#C7D6CC";
  }

  function getFillColor(item) {
    if (isItemSelected(item) || isItemHovered(item)) {
      return getActiveFillColor(item);
    }

    return getBaseFillColor(item);
  }

  function getStrokeColor(item) {
    if (isItemSelected(item)) return "#1F3B2D";
    return "#FFFFFF";
  }

  function getStrokeWidth(item) {
    if (isItemSelected(item)) return 1.4;
    if (isItemHovered(item)) return 1.1;
    return 0.8;
  }

  function handleCountryEnter(item) {
    if (dragRef.current.isPointerDown || dragRef.current.isDragging) return;
    onCountryHover?.(item?.iso2 || "", item?.label || "");
  }

  function clearHover() {
    if (dragRef.current.isPointerDown || dragRef.current.isDragging) return;
    onCountryHover?.("", "");
  }

  function handlePointerDown(event) {
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    const country = getCountryTarget(event.target);

    dragRef.current = {
      isPointerDown: true,
      isDragging: false,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: viewRef.current.panX,
      startPanY: viewRef.current.panY,
      downCountryIso: country?.iso || "",
      downCountryLabel: country?.label || "",
    };
  }

  function handlePointerMove(event) {
    const drag = dragRef.current;

    if (!drag.isPointerDown) {
      const hoveredCountry = getCountryTarget(event.target);
      if (!hoveredCountry) {
        onCountryHover?.("", "");
      }
      return;
    }

    const currentZoom = viewRef.current.zoom;
    const dx = event.clientX - drag.startClientX;
    const dy = event.clientY - drag.startClientY;
    const moveDistance = Math.abs(dx) + Math.abs(dy);

    if (!drag.isDragging && currentZoom > 1 && moveDistance > 4) {
      dragRef.current.isDragging = true;
    }

    if (!dragRef.current.isDragging) {
      return;
    }

    const nextPan = clampPan(
      {
        x: drag.startPanX + dx,
        y: drag.startPanY + dy,
      },
      currentZoom
    );

    setView(currentZoom, nextPan);
  }

  function finishPointerInteraction(event) {
    const drag = dragRef.current;

    if (drag.pointerId !== null) {
      try {
        if (
          event.currentTarget &&
          typeof event.currentTarget.releasePointerCapture === "function" &&
          event.currentTarget.hasPointerCapture?.(drag.pointerId)
        ) {
          event.currentTarget.releasePointerCapture(drag.pointerId);
        }
      } catch (error) {
        // ignore capture release errors
      }
    }

    const wasDragging = drag.isDragging;
    const clickedIso = drag.downCountryIso;
    const clickedLabel = drag.downCountryLabel;

    dragRef.current = {
      isPointerDown: false,
      isDragging: false,
      pointerId: null,
      startClientX: 0,
      startClientY: 0,
      startPanX: 0,
      startPanY: 0,
      downCountryIso: "",
      downCountryLabel: "",
    };

    if (!wasDragging && clickedIso) {
      onCountryClick?.(clickedIso, clickedLabel);
    }
  }

  function handlePointerCancel(event) {
    const drag = dragRef.current;

    if (drag.pointerId !== null) {
      try {
        if (
          event.currentTarget &&
          typeof event.currentTarget.releasePointerCapture === "function" &&
          event.currentTarget.hasPointerCapture?.(drag.pointerId)
        ) {
          event.currentTarget.releasePointerCapture(drag.pointerId);
        }
      } catch (error) {
        // ignore capture release errors
      }
    }

    dragRef.current = {
      isPointerDown: false,
      isDragging: false,
      pointerId: null,
      startClientX: 0,
      startClientY: 0,
      startPanX: 0,
      startPanY: 0,
      downCountryIso: "",
      downCountryLabel: "",
    };
  }

  function resetView() {
    handlePointerCancel({
      currentTarget: svgRef.current,
    });

    setView(1, { x: 0, y: 0 });
  }

  function zoomIn() {
    const currentZoom = viewRef.current.zoom;
    const currentPan = {
      x: viewRef.current.panX,
      y: viewRef.current.panY,
    };

    const nextZoom = clamp(currentZoom * 1.2, 1, 8);
    const nextPan = clampPan(currentPan, nextZoom);

    setView(nextZoom, nextPan);
  }

  function zoomOut() {
    const currentZoom = viewRef.current.zoom;
    const currentPan = {
      x: viewRef.current.panX,
      y: viewRef.current.panY,
    };

    const nextZoom = clamp(currentZoom / 1.2, 1, 8);
    const nextPan = clampPan(currentPan, nextZoom);

    setView(nextZoom, nextPan);
  }

  const isDraggingNow = dragRef.current.isDragging;
  const isZoomed = viewRef.current.zoom > 1;

  return (
    <div
      ref={wrapperRef}
      className="flat-map-wrap"
      style={{
        width: "100%",
        minHeight: 300,
        position: "relative",
        userSelect: "none",
        overflow: "hidden",
        overscrollBehavior: "contain",
        touchAction: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 2,
          display: "flex",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={zoomOut}
          className="secondary-button"
          style={{ padding: "6px 10px" }}
        >
          −
        </button>

        <button
          type="button"
          onClick={zoomIn}
          className="secondary-button"
          style={{ padding: "6px 10px" }}
        >
          +
        </button>

        <button
          type="button"
          onClick={resetView}
          className="secondary-button"
          style={{ padding: "6px 10px" }}
        >
          Сброс
        </button>
      </div>

      <svg
        ref={svgRef}
        width="100%"
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="img"
        aria-label="Карта стран мира"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerInteraction}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={() => {
          if (!dragRef.current.isPointerDown) {
            onCountryHover?.("", "");
          }
        }}
        onDoubleClick={resetView}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          cursor: isDraggingNow ? "grabbing" : isZoomed ? "grab" : "default",
        }}
      >
        <rect
          x="0"
          y="0"
          width={size.width}
          height={size.height}
          rx="18"
          fill="transparent"
        />

        <g ref={viewportRef}>
          {mapItems.map((item) => {
            if (!item.path) return null;

            const title =
              item.countryRecord?.name_ru ||
              item.countryRecord?.name_en ||
              item.label ||
              "—";

            const starbucksText = item.countryRecord
              ? item.countryRecord.has_starbucks_current
                ? "есть"
                : "нет"
              : "не определён";

            return (
              <path
                key={`${item.iso2 || item.label}-${item.path.length}`}
                d={item.path}
                data-country-iso={item.iso2 || ""}
                data-country-label={item.label || ""}
                fill={getFillColor(item)}
                stroke={getStrokeColor(item)}
                strokeWidth={getStrokeWidth(item)}
                vectorEffect="non-scaling-stroke"
                fillRule="evenodd"
                style={{
                  cursor: isDraggingNow ? "grabbing" : isZoomed ? "grab" : "pointer",
                  transition:
                    "fill 120ms ease, stroke 120ms ease, stroke-width 120ms ease",
                }}
                onPointerEnter={() => handleCountryEnter(item)}
              >
                <title>
                  {title} | ISO: {item.iso2 || "—"} | Starbucks: {starbucksText}
                  {" | "}Кружек: {item.mugCount || 0}
                </title>
              </path>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

export default FlatMap;