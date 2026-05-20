import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCollectionYears } from "../lib/utils";
import PersonModal, { AvatarCircle, getDisplayName, parseHandle } from "./PersonModal";

// ── Constants ─────────────────────────────────────────────────────────────────

const MOBILE_BP = 768;

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ── Random packing layout ─────────────────────────────────────────────────────

function generateRandomLayout(containerW, containerH, enriched, isMobile) {
  if (!containerW || !containerH || !enriched.length) return { nodes: [], decorNodes: [] };

  const maxCount = Math.max(1, enriched[0]?.mugsCount ?? 1);

  const refW = isMobile ? 400 : 1100;
  const refH = isMobile ? 600 : 680;
  const vscale = Math.min(1, containerW / refW, containerH / refH);

  const minR = Math.max(isMobile ? 12 : 16, Math.round((isMobile ? 20 : 26) * vscale));
  const maxR = Math.max(isMobile ? 20 : 28, Math.round((isMobile ? 52 : 78) * vscale));

  function realRadius(mugsCount) {
    const norm = Math.max(1, mugsCount) / maxCount;
    return Math.round(clamp(minR + norm * (maxR - minR), minR, maxR));
  }

  const GAP     = Math.max(4, Math.round((isMobile ? 8  : 12) * vscale));
  const PAD     = Math.max(6, Math.round((isMobile ? 16 : 28) * vscale));
  const DECOR_R = Math.max(8, Math.round((isMobile ? 14 : 19) * vscale));

  let seed = 0;
  for (const p of enriched) {
    for (let i = 0, s = String(p.id); i < s.length; i++)
      seed = (Math.imul(seed ^ s.charCodeAt(i), 0x9e3779b1) >>> 0);
  }
  if (!seed) seed = 0xdeadbeef;
  function rand() {
    seed = (seed + 0x6D2B79F5) | 0;
    let z = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    z ^= z + Math.imul(z ^ (z >>> 7), 61 | z);
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  }

  const placed = [];

  function overlaps(x, y, r) {
    for (const p of placed) {
      const dx = x - p.x, dy = y - p.y;
      if (dx * dx + dy * dy < (p.r + r + GAP) ** 2) return true;
    }
    return false;
  }

  function tryPlace(r, attempts) {
    const xMin = PAD + r, xMax = containerW - PAD - r;
    const yMin = PAD + r, yMax = containerH - PAD - r;
    if (xMin > xMax || yMin > yMax) return null;
    for (let i = 0; i < attempts; i++) {
      const x = xMin + rand() * (xMax - xMin);
      const y = yMin + rand() * (yMax - yMin);
      if (!overlaps(x, y, r)) return { x, y };
    }
    return null;
  }

  const nodes = [];
  for (const person of enriched) {
    let r = realRadius(person.mugsCount);
    let pos = tryPlace(r, 900);
    if (!pos) { r = Math.max(minR, Math.round(r * 0.75)); pos = tryPlace(r, 900); }
    if (!pos) { r = minR; pos = tryPlace(r, 2000); }
    if (pos) {
      placed.push({ x: pos.x, y: pos.y, r });
      nodes.push({ person, x: pos.x, y: pos.y, radius: r });
    }
  }

  const decorNodes = [];
  let fails = 0;
  while (fails < 80 && decorNodes.length < 200) {
    const pos = tryPlace(DECOR_R, 12);
    if (pos) {
      placed.push({ x: pos.x, y: pos.y, r: DECOR_R });
      decorNodes.push({ x: pos.x, y: pos.y, radius: DECOR_R, index: decorNodes.length });
      fails = 0;
    } else { fails++; }
  }

  return { nodes, decorNodes };
}

// ── BubbleNode ────────────────────────────────────────────────────────────────

function BubbleNode({ node, onSelect, index, outerRef, buttonRef, onHoverStart, onHoverEnd }) {
  const { person, x, y, radius } = node;
  const diameter = radius * 2;
  const name = getDisplayName(person);
  const dur   = 2.6 + (index % 9) * 0.22;
  const delay = -((index * 0.61) % dur);

  return (
    <div ref={outerRef} style={{ position: "absolute", left: x - radius, top: y - radius, willChange: "transform", transition: "opacity 0.25s ease" }}>
      <div style={{ animation: `bubbleFloat ${dur}s ease-in-out ${delay}s infinite`, willChange: "transform" }}>
        <button
          ref={buttonRef}
          type="button"
          aria-label={`${name}, ${person.mugsCount} кружек`}
          onClick={() => onSelect(person)}
          onMouseEnter={() => onHoverStart?.(index)}
          onMouseLeave={() => onHoverEnd?.(index)}
          onFocus={() => onHoverStart?.(index)}
          onBlur={() => onHoverEnd?.(index)}
          style={{
            display: "block", width: diameter, height: diameter,
            border: "none", padding: 0, borderRadius: "50%",
            cursor: "pointer", background: "transparent",
            boxShadow: "0 4px 14px rgba(21,49,38,0.16), 0 0 0 2.5px rgba(255,255,255,0.92)",
            animation: `bubbleFadeIn 0.5s ease ${index * 28}ms both`,
            outline: "none", WebkitTapHighlightColor: "transparent",
            transition: "box-shadow 0.2s ease",
          }}
        >
          <AvatarCircle person={person} size={diameter} alt={`${name}, ${person.mugsCount} кружек`} />
        </button>
      </div>
    </div>
  );
}

// ── DecorBubble ───────────────────────────────────────────────────────────────

function DecorBubble({ x, y, radius, index }) {
  const dur   = 3.1 + (index % 13) * 0.19;
  const delay = -((index * 0.83) % dur);
  return (
    <div style={{
      position: "absolute",
      left: x - radius, top: y - radius,
      width: radius * 2, height: radius * 2,
      borderRadius: "50%",
      border: "1.5px solid rgba(31,111,84,0.14)",
      background: "rgba(255,250,244,0.45)",
      animation: `bubbleFloat ${dur}s ease-in-out ${delay}s infinite`,
      pointerEvents: "none",
      willChange: "transform",
    }} />
  );
}

// ── BubbleCloud ───────────────────────────────────────────────────────────────

function BubbleCloud({ people, mugs, countries, language, isAdmin, onRefresh, searchQuery }) {
  const containerRef  = useRef(null);
  const outerRefs     = useRef([]);
  const buttonRefs    = useRef([]);
  const nodeDataRef   = useRef([]);
  const hoveredIdxRef = useRef(-1);

  const [containerW, setContainerW] = useState(0);
  const [containerH, setContainerH] = useState(0);
  const [isMobile,   setIsMobile]   = useState(false);
  const [selected,   setSelected]   = useState(null);
  const [tooltip,    setTooltip]    = useState(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      if (rect.width  > 0) { setContainerW(rect.width);  setIsMobile(rect.width < MOBILE_BP); }
      if (rect.height > 0)   setContainerH(rect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const mugsByPerson = useMemo(() => {
    const m = {};
    mugs.forEach(mug => {
      const ids = Array.isArray(mug.brought_by_person_ids) ? mug.brought_by_person_ids
        : mug.brought_by_person_id ? [mug.brought_by_person_id] : [];
      ids.forEach(id => { if (id) m[id] = (m[id] || 0) + 1; });
    });
    return m;
  }, [mugs]);

  const enriched = useMemo(() => (
    [...people]
      .map(p => ({ ...p, mugsCount: mugsByPerson[p.id] || 0 }))
      .sort((a, b) => b.mugsCount - a.mugsCount)
  ), [people, mugsByPerson]);

  const { nodes, decorNodes } = useMemo(() => {
    if (!containerW || !containerH || !enriched.length) return { nodes: [], decorNodes: [] };
    return generateRandomLayout(containerW, containerH, enriched, isMobile);
  }, [enriched, containerW, containerH, isMobile]);

  useEffect(() => {
    nodeDataRef.current = nodes.map(n => ({ x: n.x, y: n.y, r: n.radius }));
    outerRefs.current.length  = nodes.length;
    buttonRefs.current.length = nodes.length;
  }, [nodes]);

  // Apply search dimming via direct DOM (no re-render)
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    outerRefs.current.forEach((el, i) => {
      if (!el) return;
      const person = nodes[i]?.person;
      if (!person) return;
      const fullName = `${person.first_name || ""} ${person.last_name || ""}`.toLowerCase().trim();
      const handle = (person.instagram_url || "").toLowerCase();
      const match = !q || fullName.includes(q) || handle.includes(q);
      el.style.opacity = match ? "1" : "0.1";
    });
  }, [searchQuery, nodes]);

  // ── Wave + shadow ─────────────────────────────────────────────────────────────

  const applyWave = useCallback((hovIdx) => {
    const nd = nodeDataRef.current;
    outerRefs.current.forEach((el, i) => {
      if (!el || !nd[i]) return;
      const btn = buttonRefs.current[i];
      if (i === hovIdx) {
        el.style.transform  = "translateY(-30px) scale(1.35)";
        el.style.transition = "transform 0.2s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease";
        el.style.zIndex     = "20";
        if (btn) {
          btn.style.boxShadow = "0 36px 60px rgba(21,49,38,0.45), 0 12px 24px rgba(0,0,0,0.22), 0 0 0 3px rgba(255,255,255,0.95)";
          btn.style.transition = "box-shadow 0.2s ease";
        }
      } else {
        let px = 0, py = 0;
        if (hovIdx >= 0 && nd[hovIdx]) {
          const h = nd[hovIdx];
          const dx = nd[i].x - h.x, dy = nd[i].y - h.y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          const infl = h.r * 5.5;
          if (d < infl && d > 0) {
            const t = (1 - d / infl) ** 1.5;
            px = (dx / d) * t * 34;
            py = (dy / d) * t * 34;
          }
        }
        el.style.transform  = (px || py) ? `translate(${px.toFixed(1)}px,${py.toFixed(1)}px)` : "";
        el.style.transition = "transform 0.3s ease, opacity 0.25s ease";
        el.style.zIndex     = "1";
        if (btn) {
          btn.style.boxShadow = "0 4px 14px rgba(21,49,38,0.16), 0 0 0 2.5px rgba(255,255,255,0.92)";
          btn.style.transition = "box-shadow 0.3s ease";
        }
      }
    });
  }, []);

  const handleHoverStart = useCallback((idx) => {
    hoveredIdxRef.current = idx;
    applyWave(idx);
    const nd   = nodeDataRef.current[idx];
    const node = nodes[idx];
    if (!nd || !node || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltip({
      person: node.person,
      x: rect.left + nd.x + nd.r + 10,
      y: rect.top  + nd.y,
    });
  }, [applyWave, nodes]);

  const handleHoverEnd = useCallback((idx) => {
    if (hoveredIdxRef.current === idx) {
      hoveredIdxRef.current = -1;
      applyWave(-1);
      setTooltip(null);
    }
  }, [applyWave]);

  const handleSelect = useCallback((p) => setSelected(p), []);
  const handleClose  = useCallback(() => setSelected(null), []);

  return (
    <>
      <div ref={containerRef} style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
        {decorNodes.map((d) => (
          <DecorBubble key={`decor-${d.index}`} x={d.x} y={d.y} radius={d.radius} index={d.index} />
        ))}
        {nodes.map((node, i) => (
          <BubbleNode
            key={node.person.id}
            node={node}
            isMobile={isMobile}
            onSelect={handleSelect}
            index={i}
            outerRef={el => { outerRefs.current[i] = el; }}
            buttonRef={el => { buttonRefs.current[i] = el; }}
            onHoverStart={handleHoverStart}
            onHoverEnd={handleHoverEnd}
          />
        ))}
      </div>

      {tooltip && !isMobile && (
        <div aria-hidden style={{
          position: "fixed", left: tooltip.x, top: tooltip.y,
          transform: "translateY(-50%)",
          background: "rgba(21,49,38,0.95)", color: "#fff",
          borderRadius: 10, padding: "9px 14px", fontSize: 12,
          whiteSpace: "nowrap", pointerEvents: "none", zIndex: 500,
          boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{getDisplayName(tooltip.person)}</div>
          {parseHandle(tooltip.person.instagram_url) && (
            <div style={{ color: "#9dc9b0", marginBottom: 3, fontSize: 11 }}>{parseHandle(tooltip.person.instagram_url)}</div>
          )}
          <div style={{ color: "#c5e8d8" }}>
            {tooltip.person.mugsCount} {tooltip.person.mugsCount === 1 ? "кружка" : tooltip.person.mugsCount < 5 ? "кружки" : "кружек"}
          </div>
          <div style={{ position: "absolute", left: -4, top: "50%", transform: "translateY(-50%) rotate(45deg)", width: 8, height: 8, background: "rgba(21,49,38,0.95)" }} />
        </div>
      )}

      {selected && (
        <PersonModal person={selected} mugs={mugs} countries={countries} language={language} isAdmin={isAdmin} onClose={handleClose} onRefresh={onRefresh} />
      )}
    </>
  );
}

// ── PeoplePage ────────────────────────────────────────────────────────────────

export default function PeoplePage({ people: peopleProp = [], mugs = [], countries = [], language = "ru", isAdmin = false, onRefresh }) {
  const visible = useMemo(() => (peopleProp ?? []).filter(p => p.is_visible !== false), [peopleProp]);
  // Owner is excluded from the bubble cloud (they skew the size scale)
  const bubblePeople = useMemo(() => visible.filter(p => !p.is_owner), [visible]);
  const years = getCollectionYears();
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div style={{ height: "calc(100vh - 52px)", display: "flex", flexDirection: "column", background: "#faf7f3", overflow: "hidden" }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "0 16px 0 20px", height: 52, flexShrink: 0,
        background: "#fff", borderBottom: "0.5px solid #e8e2d9",
      }}>
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#153126", whiteSpace: "nowrap", flexShrink: 0 }}>
          {language === "en" ? "People Behind the Collection" : "Люди за коллекцией"}
        </h1>

        {/* Search input */}
        <div style={{ flex: 1, maxWidth: 260, position: "relative" }}>
          <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#9ca3af" }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={language === "en" ? "Search by name…" : "Поиск по имени…"}
            style={{
              width: "100%", padding: "6px 10px 6px 30px",
              border: "1px solid #e2ddd4", borderRadius: 20,
              fontSize: 13, outline: "none", background: "#faf7f3",
              boxSizing: "border-box",
            }}
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery("")} style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer",
              fontSize: 14, color: "#9ca3af", lineHeight: 1, padding: 0,
            }}>×</button>
          )}
        </div>

        <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#5f6f66", flexShrink: 0, marginLeft: "auto" }}>
          {[
            { n: visible.length, label: language === "en" ? "contributors" : "участников" },
            { n: mugs.length,    label: language === "en" ? "mugs"         : "кружек" },
            { n: years,          label: language === "en" ? "years"        : "лет" },
          ].map(s => (
            <span key={s.label} style={{ whiteSpace: "nowrap" }}>
              <strong style={{ color: "#153126" }}>{s.n}</strong>{" "}{s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Bubble canvas */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {visible.length === 0 ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#8a9e96" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>☕</div>
              <p style={{ fontSize: 14 }}>{language === "en" ? "No contributors yet." : "Пока нет участников."}</p>
            </div>
          </div>
        ) : (
          <BubbleCloud
            people={bubblePeople} mugs={mugs} countries={countries}
            language={language} isAdmin={isAdmin} onRefresh={onRefresh}
            searchQuery={searchQuery}
          />
        )}
      </div>

      <style>{`
        @keyframes bubbleFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-7px); }
        }
        @keyframes bubbleFadeIn {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes modalBgIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  );
}
