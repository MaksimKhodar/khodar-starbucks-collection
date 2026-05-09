import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SQRT3 = Math.sqrt(3);
const HEX_CLIP = "polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)";

const LEVELS = [
  { min: 18, label: "Золотой",    labelEn: "Gold",   color: "#FFD700", glow: "rgba(255,215,0,0.7)",    range: "18+" },
  { min: 12, label: "Серебряный", labelEn: "Silver", color: "#C0C0C0", glow: "rgba(192,192,192,0.7)", range: "12–17" },
  { min: 6,  label: "Бронзовый", labelEn: "Bronze", color: "#CD7F32", glow: "rgba(205,127,50,0.7)",   range: "6–11" },
  { min: 1,  label: "Зелёный",   labelEn: "Green",  color: "#1f6f54", glow: "rgba(31,111,84,0.6)",    range: "1–5" },
];

function getLevel(count) {
  return LEVELS.find(l => count >= l.min) ?? LEVELS[LEVELS.length - 1];
}

function parseHandle(url) {
  if (!url) return null;
  try {
    const h = new URL(url).pathname.replace(/\/$/, "").split("/").filter(Boolean).pop();
    return h ? `@${h}` : null;
  } catch {
    const c = url.replace(/^@/, "").trim();
    return c ? `@${c}` : null;
  }
}

function getDisplayName(p) {
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || parseHandle(p.instagram_url) || "—";
}

function getInitials(p) {
  const n = [p.first_name?.[0], p.last_name?.[0]].filter(Boolean).join("").toUpperCase();
  return n || parseHandle(p.instagram_url)?.[1]?.toUpperCase() || "?";
}

// Axial hex spiral
function hexSpiral(count) {
  const pos = [[0, 0]];
  let ring = 1;
  while (pos.length < count) {
    let q = ring, r = -ring;
    const dirs = [[0,1],[-1,1],[-1,0],[0,-1],[1,-1],[1,0]];
    for (let d = 0; d < 6; d++) {
      for (let s = 0; s < ring; s++) {
        if (pos.length >= count) break;
        pos.push([q, r]);
        q += dirs[d][0]; r += dirs[d][1];
      }
    }
    ring++;
  }
  return pos;
}

function axialToPixel(q, r, size) {
  return { x: size * SQRT3 * (q + r / 2), y: size * 1.5 * r };
}

// ── HexCell ───────────────────────────────────────────────────────────────────

function HexCell({ person, mugCount, cellRef, size, left, top }) {
  const [hovered, setHovered] = useState(false);
  const level = person ? getLevel(mugCount) : null;
  const handle = person ? parseHandle(person.instagram_url) : null;
  const name = person ? getDisplayName(person) : null;
  const avatarUrl = person?.avatar_image_path
    ? `${SUPABASE_URL}/storage/v1/object/public/mug-images/${person.avatar_image_path}`
    : null;

  const w = size * SQRT3;
  const h = size * 2;
  const BORDER = 4;

  return (
    <div
      ref={cellRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "absolute",
        left, top,
        width: w, height: h,
        willChange: "transform",
        transition: "transform 0.15s ease",
        zIndex: hovered ? 20 : 1,
        cursor: person ? "pointer" : "default",
      }}
    >
      {/* Border frame */}
      {person && (
        <div style={{
          position: "absolute",
          inset: -BORDER,
          clipPath: HEX_CLIP,
          background: hovered
            ? `radial-gradient(circle, ${level.color}ff, ${level.color}cc)`
            : `radial-gradient(circle, ${level.color}cc, ${level.color}88)`,
          filter: hovered ? `drop-shadow(0 0 10px ${level.glow})` : "none",
          transition: "filter 0.2s, background 0.2s",
        }} />
      )}

      {/* Inner hex */}
      <div style={{
        position: "absolute",
        inset: person ? BORDER : 0,
        clipPath: HEX_CLIP,
        overflow: "hidden",
        background: person ? "#1a2a22" : "rgba(180,170,155,0.12)",
      }}>
        {person && (
          avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div style={{
              width: "100%", height: "100%",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: level.color + "28",
              fontSize: size * 0.38, fontWeight: 700, color: level.color,
            }}>
              {getInitials(person)}
            </div>
          )
        )}
      </div>

      {/* Hover tooltip */}
      {person && hovered && (
        <div style={{
          position: "absolute",
          bottom: h + 10,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(12,22,16,0.96)",
          color: "#fff",
          borderRadius: 10,
          padding: "9px 14px",
          fontSize: 12,
          whiteSpace: "nowrap",
          zIndex: 100,
          pointerEvents: "none",
          boxShadow: `0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px ${level.color}44`,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>{handle || name}</div>
          <div style={{ color: "#9dc9b0", marginBottom: 2 }}>{mugCount} кружек</div>
          <div style={{ color: level.color, fontSize: 11 }}>{level.label} уровень</div>
          {/* Arrow */}
          <div style={{
            position: "absolute", bottom: -5, left: "50%",
            transform: "translateX(-50%)",
            width: 10, height: 5,
            background: "rgba(12,22,16,0.96)",
            clipPath: "polygon(0 0,100% 0,50% 100%)",
          }} />
        </div>
      )}
    </div>
  );
}

// ── HallOfFame ─────────────────────────────────────────────────────────────────

export default function HallOfFame({ people = [], mugs = [], language = "ru" }) {
  const containerRef = useRef(null);
  const cellRefs = useRef([]);
  const [ripples, setRipples] = useState([]);
  const animFrame = useRef(null);

  // Mug counts
  const mugsByPerson = useMemo(() => {
    const m = {};
    mugs.forEach(mug => {
      const ids = Array.isArray(mug.brought_by_person_ids) ? mug.brought_by_person_ids
        : mug.brought_by_person_id ? [mug.brought_by_person_id] : [];
      ids.forEach(id => { if (id) m[id] = (m[id] || 0) + 1; });
    });
    return m;
  }, [mugs]);

  const sortedPeople = useMemo(() => (
    [...people]
      .filter(p => (mugsByPerson[p.id] || 0) > 0)
      .sort((a, b) => (mugsByPerson[b.id] || 0) - (mugsByPerson[a.id] || 0))
  ), [people, mugsByPerson]);

  const cellSize = 52;
  const cellW = cellSize * SQRT3;
  const cellH = cellSize * 2;

  const totalCells = Math.max(sortedPeople.length + 36, 91);
  const spiralPos = useMemo(() => hexSpiral(totalCells), [totalCells]);

  const pixels = useMemo(
    () => spiralPos.map(([q, r]) => axialToPixel(q, r, cellSize)),
    [spiralPos, cellSize],
  );

  const { minX, minY, canvasW, canvasH } = useMemo(() => {
    const xs = pixels.map(p => p.x), ys = pixels.map(p => p.y);
    const pad = cellW;
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    return {
      minX, minY,
      canvasW: Math.max(...xs) - minX + pad,
      canvasH: Math.max(...ys) - minY + pad,
    };
  }, [pixels, cellW]);

  // Cell screen positions (offset from canvas origin)
  const cellPositions = useMemo(
    () => pixels.map(({ x, y }) => ({
      left: x - minX - cellW / 2,
      top:  y - minY - cellH / 2,
      cx:   x - minX,
      cy:   y - minY,
    })),
    [pixels, minX, minY, cellW, cellH],
  );

  // Wave effect — direct DOM manipulation to avoid re-renders
  const handleMouseMove = useCallback((e) => {
    if (animFrame.current) cancelAnimationFrame(animFrame.current);
    animFrame.current = requestAnimationFrame(() => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      cellRefs.current.forEach((el, i) => {
        if (!el) return;
        const { cx, cy } = cellPositions[i];
        const dx = cx - mx, dy = cy - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const wave = Math.max(0, 1 - dist / 200) * -14;
        el.style.transform = `translateY(${wave}px)`;
      });
    });
  }, [cellPositions]);

  const handleMouseLeave = useCallback(() => {
    if (animFrame.current) cancelAnimationFrame(animFrame.current);
    cellRefs.current.forEach(el => { if (el) el.style.transform = ""; });
  }, []);

  const handleClick = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const id = Date.now();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setRipples(prev => [...prev, { id, x, y }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 900);
  }, []);

  useEffect(() => () => { if (animFrame.current) cancelAnimationFrame(animFrame.current); }, []);

  return (
    <div style={{ background: "#f5f0e8", minHeight: "100vh", overflowX: "auto" }}>

      {/* Header */}
      <div style={{ textAlign: "center", padding: "48px 20px 32px" }}>
        <p style={{
          margin: "0 0 10px", fontSize: 11, fontWeight: 700,
          color: "#b8912a", textTransform: "uppercase", letterSpacing: "0.12em",
        }}>
          ★ &nbsp;Hall of Fame&nbsp; ★
        </p>
        <h1 style={{ margin: "0 0 12px", fontSize: 36, fontWeight: 800, color: "#153126", letterSpacing: "-0.01em" }}>
          Зал кружечной славы
        </h1>
        <p style={{ margin: "0 0 28px", fontSize: 14, color: "#5f6f66", lineHeight: 1.6 }}>
          {sortedPeople.length} человек · {mugs.length} кружек · 11 лет дружбы и путешествий
        </p>

        {/* Legend */}
        <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" }}>
          {[...LEVELS].reverse().map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 18, height: 18, clipPath: HEX_CLIP, background: l.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#5f6f66" }}>
                {l.range} кружек &mdash; {l.label} уровень
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Honeycomb canvas */}
      <div style={{ display: "flex", justifyContent: "center", paddingBottom: 60 }}>
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          style={{
            position: "relative",
            width: canvasW,
            height: canvasH,
            cursor: "crosshair",
            flexShrink: 0,
          }}
        >
          {spiralPos.map(([q, r], i) => {
            const { left, top } = cellPositions[i];
            const person = sortedPeople[i] ?? null;
            const mugCount = person ? (mugsByPerson[person.id] || 0) : 0;
            return (
              <HexCell
                key={i}
                person={person}
                mugCount={mugCount}
                cellRef={el => { cellRefs.current[i] = el; }}
                size={cellSize}
                left={left}
                top={top}
              />
            );
          })}

          {/* Click ripples */}
          {ripples.map(r => (
            <div
              key={r.id}
              style={{
                position: "absolute",
                left: r.x, top: r.y,
                transform: "translate(-50%,-50%)",
                pointerEvents: "none",
                zIndex: 50,
                animation: "hof-ripple 0.9s ease-out forwards",
                width: 0, height: 0,
                borderRadius: "50%",
                border: "2px solid rgba(31,111,84,0.5)",
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes hof-ripple {
          0%   { width: 0; height: 0; opacity: 1; }
          100% { width: 320px; height: 320px; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
