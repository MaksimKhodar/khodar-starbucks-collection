import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMugImageUrl } from "../lib/storage";

// ── Constants ─────────────────────────────────────────────────────────────────

const MOBILE_BP = 768;
const GAP_DESKTOP = 14;
const GAP_MOBILE  = 8;

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ── Radius calculation ────────────────────────────────────────────────────────

function calcRadius(mugsCount, maxCount, isMobile) {
  const minR = isMobile ? 22 : 30;
  const maxR = isMobile ? 78 : 130;
  const safe = Math.max(1, mugsCount ?? 1);
  const normalized = Math.sqrt(safe) / Math.sqrt(Math.max(1, maxCount));
  return clamp(minR + normalized * (maxR - minR), minR, maxR);
}

// ── Circle-packing: golden-angle spiral search ────────────────────────────────

const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // ~137.5°

function packBubbles(nodes, gap) {
  const placed = [];
  for (let ni = 0; ni < nodes.length; ni++) {
    const node = nodes[ni];
    if (ni === 0) { placed.push({ ...node, x: 0, y: 0 }); continue; }

    const step = Math.max(node.radius, 20) * 0.55;
    let found = false;
    for (let k = 1; k <= 4000; k++) {
      const r = Math.sqrt(k) * step;
      const a = k * GOLDEN;
      const cx = r * Math.cos(a);
      const cy = r * Math.sin(a);
      let ok = true;
      for (const p of placed) {
        const dx = cx - p.x, dy = cy - p.y;
        if (dx * dx + dy * dy < (p.radius + node.radius + gap) ** 2) { ok = false; break; }
      }
      if (ok) { placed.push({ ...node, x: cx, y: cy }); found = true; break; }
    }
    if (!found) placed.push({ ...node, x: 0, y: 0 });
  }
  return placed;
}

function fitToContainer(placed, containerW) {
  if (!placed.length) return { nodes: [], height: 320 };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of placed) {
    minX = Math.min(minX, p.x - p.radius); maxX = Math.max(maxX, p.x + p.radius);
    minY = Math.min(minY, p.y - p.radius); maxY = Math.max(maxY, p.y + p.radius);
  }
  const PAD = 24;
  const layoutW = maxX - minX;
  const layoutH = maxY - minY;
  const scale = layoutW + PAD * 2 > containerW ? (containerW - PAD * 2) / layoutW : 1;
  const scaledW = layoutW * scale;
  const offsetX = (containerW - scaledW) / 2 - minX * scale;
  const offsetY = PAD - minY * scale;
  const nodes = placed.map(p => ({
    ...p, x: p.x * scale + offsetX, y: p.y * scale + offsetY, radius: p.radius * scale,
  }));
  return { nodes, height: layoutH * scale + PAD * 2 };
}

// ── AvatarCircle ──────────────────────────────────────────────────────────────

function AvatarCircle({ person, size, alt }) {
  const [imgError, setImgError] = useState(false);
  const url = person.avatar_image_path && !imgError ? getMugImageUrl(person.avatar_image_path) : null;

  if (url) {
    return (
      <img
        src={url}
        alt={alt}
        loading="lazy"
        onError={() => setImgError(true)}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }}
      />
    );
  }
  return (
    <div aria-label={alt} style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "linear-gradient(135deg, #1f6f54, #2d9970)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size * 0.34, fontWeight: 700, letterSpacing: "-0.02em",
    }}>
      {getInitials(person)}
    </div>
  );
}

// ── BubbleNode ────────────────────────────────────────────────────────────────

function BubbleNode({ node, isMobile, onSelect, index }) {
  const [hovered, setHovered] = useState(false);
  const { person, x, y, radius } = node;
  const handle = parseHandle(person.instagram_url);
  const mugCount = person.mugsCount;
  const name = getDisplayName(person);
  const diameter = radius * 2;

  const tooltipLeft = x + radius + 8;

  return (
    <div style={{ position: "absolute", left: x - radius, top: y - radius, zIndex: hovered ? 20 : 1 }}>
      <button
        type="button"
        aria-label={`${name}, ${mugCount} ${mugCount === 1 ? "кружка" : mugCount < 5 ? "кружки" : "кружек"}`}
        onClick={() => onSelect(person)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "block",
          width: diameter, height: diameter,
          borderRadius: "50%",
          border: "none",
          padding: 0,
          cursor: "pointer",
          background: "transparent",
          // Staggered fade-in
          animation: `bubbleFadeIn 0.5s ease both`,
          animationDelay: `${index * 30}ms`,
          transform: hovered ? "scale(1.07)" : "scale(1)",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
          boxShadow: hovered
            ? "0 8px 28px rgba(21,49,38,0.22), 0 0 0 3px rgba(255,255,255,0.7)"
            : "0 3px 12px rgba(21,49,38,0.14), 0 0 0 2.5px rgba(255,255,255,0.85)",
          outline: "none",
          WebkitTapHighlightColor: "transparent",
        }}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        <AvatarCircle person={person} size={diameter} alt={`${name}, ${mugCount} кружек`} />
      </button>

      {/* Desktop tooltip */}
      {!isMobile && hovered && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "50%", left: diameter + 10,
            transform: "translateY(-50%)",
            background: "rgba(21,49,38,0.95)",
            color: "#fff", borderRadius: 10,
            padding: "8px 13px", fontSize: 12,
            whiteSpace: "nowrap", pointerEvents: "none",
            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
            zIndex: 50,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{handle || name}</div>
          <div style={{ color: "#9dc9b0" }}>
            {mugCount} {mugCount === 1 ? "кружка" : mugCount < 5 ? "кружки" : "кружек"}
          </div>
          <div style={{
            position: "absolute", left: -4, top: "50%", transform: "translateY(-50%)",
            width: 8, height: 8, background: "rgba(21,49,38,0.95)", borderRadius: 1,
            rotate: "45deg",
          }} />
        </div>
      )}
    </div>
  );
}

// ── SizeLegend ────────────────────────────────────────────────────────────────

function SizeLegend({ language }) {
  const samples = [
    { r: 14, label: language === "en" ? "1 mug" : "1 кружка" },
    { r: 22, label: language === "en" ? "~5 mugs" : "~5 кружек" },
    { r: 32, label: language === "en" ? "~15 mugs" : "~15 кружек" },
    { r: 44, label: language === "en" ? "~30+ mugs" : "~30+ кружек" },
  ];
  return (
    <div style={{
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      gap: 28, padding: "20px 16px 0", flexWrap: "wrap",
    }}>
      {samples.map(s => (
        <div key={s.r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{
            width: s.r * 2, height: s.r * 2, borderRadius: "50%",
            background: "#e8e1d7",
            boxShadow: "0 0 0 2px rgba(255,255,255,0.8), 0 2px 8px rgba(0,0,0,0.1)",
          }} />
          <span style={{ fontSize: 10, color: "#8a9e96" }}>{s.label}</span>
        </div>
      ))}
      <p style={{ width: "100%", textAlign: "center", fontSize: 12, color: "#8a9e96", margin: 0, marginTop: 4 }}>
        {language === "en" ? "The larger the photo, the more mugs gifted" : "Чем больше фото — тем больше подарено кружек"}
      </p>
    </div>
  );
}

// ── PersonModal ───────────────────────────────────────────────────────────────

function PersonModal({ person, mugs, countries, language, onClose, onEditMug }) {
  const overlayRef = useRef(null);
  const closeRef = useRef(null);

  const name = getDisplayName(person);
  const handle = parseHandle(person.instagram_url);
  const mugCount = person.mugsCount;

  const personMugs = useMemo(() => {
    if (!person?.id) return [];
    return mugs.filter(m => {
      const ids = Array.isArray(m.brought_by_person_ids) ? m.brought_by_person_ids
        : m.brought_by_person_id ? [m.brought_by_person_id] : [];
      return ids.includes(person.id);
    });
  }, [mugs, person?.id]);

  const visitedCountries = useMemo(() => {
    const seen = new Set();
    return personMugs.flatMap(m => {
      const c = countries.find(c => c.id === m.country_id);
      if (!c || seen.has(c.id)) return [];
      seen.add(c.id);
      return [c];
    });
  }, [personMugs, countries]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const prev = document.activeElement;
    closeRef.current?.focus();
    return () => { document.body.style.overflow = ""; prev?.focus(); };
  }, []);

  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleOverlayClick(e) { if (e.target === overlayRef.current) onClose(); }

  return (
    <div
      ref={overlayRef}
      role="dialog" aria-modal="true" aria-labelledby="person-modal-name"
      onClick={handleOverlayClick}
      style={{
        position: "fixed", inset: 0, zIndex: 600,
        background: "rgba(15,30,20,0.48)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
        animation: "modalBgIn 0.2s ease",
      }}
    >
      <div
        style={{
          background: "#fffaf4",
          borderRadius: 20,
          width: "100%", maxWidth: 560,
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 24px 64px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06)",
          animation: "modalIn 0.22s ease",
          display: "flex", flexDirection: "column",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "24px 24px 16px" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <AvatarCircle
              person={person}
              size={72}
              alt={`${name}, ${mugCount} кружек`}
            />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="person-modal-name" style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#153126" }}>
              {name}
            </h2>
            {handle && (
              <a
                href={person.instagram_url}
                target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13, color: "#1f6f54", fontWeight: 600, textDecoration: "none" }}
              >
                {handle}
              </a>
            )}
            <div style={{ marginTop: 6, fontSize: 13, color: "#5f6f66" }}>
              <strong style={{ color: "#153126" }}>{mugCount}</strong>{" "}
              {mugCount === 1 ? "кружка" : mugCount < 5 ? "кружки" : "кружек"}
              {visitedCountries.length > 0 && (
                <> · <strong style={{ color: "#153126" }}>{visitedCountries.length}</strong>{" "}
                {language === "en" ? "countries" : "стран"}</>
              )}
            </div>
          </div>

          <button
            ref={closeRef}
            type="button"
            aria-label={language === "en" ? "Close" : "Закрыть"}
            onClick={onClose}
            style={{
              background: "#f5f0e8", border: "none", borderRadius: "50%",
              width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, color: "#5f6f66", cursor: "pointer", flexShrink: 0,
              lineHeight: 1,
            }}
          >×</button>
        </div>

        {/* Bio */}
        {person.bio && (
          <p style={{ margin: "0 24px 16px", fontSize: 13, color: "#5f6f66", lineHeight: 1.65 }}>
            {person.bio}
          </p>
        )}

        {/* Country tags */}
        {visitedCountries.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "0 24px 16px" }}>
            {visitedCountries.map(c => {
              const count = personMugs.filter(m => m.country_id === c.id).length;
              return (
                <span key={c.id} style={{
                  padding: "3px 10px", borderRadius: 999,
                  background: "#e8f5ee", color: "#1a6340", fontSize: 12, fontWeight: 600,
                }}>
                  {language === "en" ? c.name_en : c.name_ru} ({count})
                </span>
              );
            })}
          </div>
        )}

        <div style={{ borderTop: "0.5px solid #e8e2d9" }} />

        {/* Mugs */}
        <div style={{ padding: "16px 24px 24px" }}>
          {personMugs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#8a9e96", fontSize: 14 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>☕</div>
              {language === "en" ? "No mugs attributed yet" : "Кружки пока не привязаны"}
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#31443a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                {language === "en" ? "Gifted mugs" : "Подаренные кружки"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
                {personMugs.map(mug => {
                  const img = mug.mug_images?.[0];
                  const imgUrl = img ? getMugImageUrl(img.storage_path) : null;
                  return (
                    <div key={mug.id} style={{
                      borderRadius: 10, overflow: "hidden",
                      background: "#f5f0e8", border: "1px solid #e8e2d9",
                    }}>
                      <div style={{ aspectRatio: "1/1", background: "#ede7dc" }}>
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={mug.title}
                            loading="lazy"
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#aaa" }}>
                            ☕
                          </div>
                        )}
                      </div>
                      <div style={{ padding: "5px 7px" }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#153126", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {mug.title}
                        </div>
                        <div style={{ fontSize: 9, color: "#8a9e96", marginTop: 1 }}>#{mug.collection_number}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── BubbleCloud ───────────────────────────────────────────────────────────────

function BubbleCloud({ people, mugs, countries, language, onSelect }) {
  const containerRef = useRef(null);
  const [containerW, setContainerW] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Measure container width via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) { setContainerW(w); setIsMobile(w < MOBILE_BP); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Mug counts per person
  const mugsByPerson = useMemo(() => {
    const m = {};
    mugs.forEach(mug => {
      const ids = Array.isArray(mug.brought_by_person_ids) ? mug.brought_by_person_ids
        : mug.brought_by_person_id ? [mug.brought_by_person_id] : [];
      ids.forEach(id => { if (id) m[id] = (m[id] || 0) + 1; });
    });
    return m;
  }, [mugs]);

  // Enriched + sorted people nodes
  const enrichedPeople = useMemo(() => {
    const maxCount = Math.max(1, ...people.map(p => mugsByPerson[p.id] || 0));
    return people
      .map(p => ({ ...p, mugsCount: mugsByPerson[p.id] || 0 }))
      .sort((a, b) => b.mugsCount - a.mugsCount);
  }, [people, mugsByPerson]);

  // Layout computation
  const { nodes, height } = useMemo(() => {
    if (!containerW || !enrichedPeople.length) return { nodes: [], height: 320 };
    const maxCount = enrichedPeople[0]?.mugsCount ?? 1;
    const gap = isMobile ? GAP_MOBILE : GAP_DESKTOP;
    const withRadius = enrichedPeople.map(p => ({
      person: p,
      radius: calcRadius(p.mugsCount, maxCount, isMobile),
    }));
    const packed = packBubbles(withRadius, gap);
    return fitToContainer(packed, containerW);
  }, [enrichedPeople, containerW, isMobile]);

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      {containerW > 0 && (
        <div style={{ position: "relative", width: "100%", height, overflow: "visible" }}>
          {nodes.map((node, i) => (
            <BubbleNode
              key={node.person.id}
              node={node}
              isMobile={isMobile}
              onSelect={onSelect}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── PeoplePage ────────────────────────────────────────────────────────────────

function PeoplePage({ people: peopleProp = [], mugs = [], countries = [], language = "ru" }) {
  const [selected, setSelected] = useState(null);

  // Only visible people, fallback to prop
  const visiblePeople = useMemo(
    () => (peopleProp ?? []).filter(p => p.is_visible !== false),
    [peopleProp],
  );

  const mugCount = mugs.length;
  const yearCount = 11;

  const closeModal = useCallback(() => setSelected(null), []);

  return (
    <div style={{ background: "#faf7f3", minHeight: "100vh" }}>

      {/* Hero */}
      <div style={{ textAlign: "center", padding: "52px 24px 28px", maxWidth: 660, margin: "0 auto" }}>
        <p style={{
          margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#1f6f54",
          textTransform: "uppercase", letterSpacing: "0.1em",
        }}>
          {language === "en" ? "Starbucks Mug Collection" : "Коллекция кружек Starbucks"}
        </p>
        <h1 style={{ margin: "0 0 14px", fontSize: 32, fontWeight: 800, color: "#153126", lineHeight: 1.2 }}>
          {language === "en" ? "People Behind the Collection" : "Люди за коллекцией"}
        </h1>
        <p style={{ margin: "0 0 28px", fontSize: 14, color: "#5f6f66", lineHeight: 1.7 }}>
          {language === "en"
            ? `${visiblePeople.length} friends helped grow this collection across ${yearCount} years of travels. The larger the photo, the more mugs gifted.`
            : `${visiblePeople.length} друзей помогли собрать эту коллекцию за ${yearCount} лет путешествий. Чем больше фото — тем больше подарено кружек.`}
        </p>

        {/* Stats */}
        <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { n: visiblePeople.length, label: language === "en" ? "contributors" : "участников" },
            { n: mugCount, label: language === "en" ? "mugs" : "кружек" },
            { n: yearCount, label: language === "en" ? "years" : "лет" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#153126", lineHeight: 1 }}>{s.n}</div>
              <div style={{ fontSize: 12, color: "#8a9e96", marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bubble cloud */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px" }}>
        {visiblePeople.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#8a9e96" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>☕</div>
            <p style={{ fontSize: 14 }}>
              {language === "en" ? "No contributors to show yet." : "Пока нет участников для отображения."}
            </p>
          </div>
        ) : (
          <BubbleCloud
            people={visiblePeople}
            mugs={mugs}
            countries={countries}
            language={language}
            onSelect={setSelected}
          />
        )}
      </div>

      {/* Size legend */}
      {visiblePeople.length > 0 && <SizeLegend language={language} />}

      {/* Bottom padding */}
      <div style={{ height: 60 }} />

      {/* Modal */}
      {selected && (
        <PersonModal
          person={selected}
          mugs={mugs}
          countries={countries}
          language={language}
          onClose={closeModal}
        />
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes bubbleFadeIn {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes modalBgIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
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

export default PeoplePage;
