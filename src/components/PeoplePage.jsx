import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMugImageUrl, uploadMugImage } from "../lib/storage";
import { supabase } from "../lib/supabase";
import { getCollectionYears, ruYears } from "../lib/utils";
import ImageCropperModal from "./ImageCropperModal";
import MugCarousel from "./MugCarousel";

// ── Constants ─────────────────────────────────────────────────────────────────

const MOBILE_BP  = 768;
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

// ── Radius calculation (sqrt scale) ──────────────────────────────────────────

function calcRadius(mugsCount, maxCount, isMobile) {
  const minR = isMobile ? 22 : 30;
  const maxR = isMobile ? 78 : 130;
  const safe = Math.max(1, mugsCount ?? 1);
  const norm = Math.sqrt(safe) / Math.sqrt(Math.max(1, maxCount));
  return clamp(minR + norm * (maxR - minR), minR, maxR);
}

// ── Circle-packing (golden-angle spiral search) ───────────────────────────────

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

function packBubbles(nodes, gap) {
  const placed = [];
  for (let ni = 0; ni < nodes.length; ni++) {
    const node = nodes[ni];
    if (ni === 0) { placed.push({ ...node, x: 0, y: 0 }); continue; }
    const step = Math.max(node.radius, 20) * 0.55;
    let placed_ = false;
    for (let k = 1; k <= 4000; k++) {
      const r = Math.sqrt(k) * step;
      const a = k * GOLDEN;
      const cx = r * Math.cos(a), cy = r * Math.sin(a);
      let ok = true;
      for (const p of placed) {
        const dx = cx - p.x, dy = cy - p.y;
        if (dx * dx + dy * dy < (p.radius + node.radius + gap) ** 2) { ok = false; break; }
      }
      if (ok) { placed.push({ ...node, x: cx, y: cy }); placed_ = true; break; }
    }
    if (!placed_) placed.push({ ...node, x: 0, y: 0 });
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
  const PAD = 28;
  const layoutW = maxX - minX, layoutH = maxY - minY;
  const scale = layoutW + PAD * 2 > containerW ? (containerW - PAD * 2) / layoutW : 1;
  const scaledW = layoutW * scale;
  const offsetX = (containerW - scaledW) / 2 - minX * scale;
  const offsetY = PAD - minY * scale;
  return {
    nodes: placed.map(p => ({
      ...p,
      x: p.x * scale + offsetX,
      y: p.y * scale + offsetY,
      radius: p.radius * scale,
    })),
    height: layoutH * scale + PAD * 2,
  };
}

// ── AvatarCircle ──────────────────────────────────────────────────────────────

function AvatarCircle({ person, size, alt }) {
  const [imgErr, setImgErr] = useState(false);
  const url = person.avatar_image_path && !imgErr ? getMugImageUrl(person.avatar_image_path) : null;
  if (url) {
    return (
      <img src={url} alt={alt} loading="lazy" onError={() => setImgErr(true)}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }} />
    );
  }
  return (
    <div aria-label={alt} style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg,#1f6f54,#2d9970)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size * 0.34, fontWeight: 700, letterSpacing: "-0.02em",
    }}>
      {getInitials(person)}
    </div>
  );
}

// ── BubbleNode ────────────────────────────────────────────────────────────────

function BubbleNode({ node, isMobile, onSelect, index, outerRef, buttonRef, onHoverStart, onHoverEnd }) {
  const [showTip, setShowTip] = useState(false);
  const { person, x, y, radius } = node;
  const diameter = radius * 2;
  const name = getDisplayName(person);
  const handle = parseHandle(person.instagram_url);

  // Each bubble gets a unique float duration + negative delay (= phase offset)
  const dur   = 2.6 + (index % 9) * 0.22;  // 2.6 – 4.4 s
  const delay = -((index * 0.61) % dur);    // random-looking phase

  return (
    <div
      ref={outerRef}
      style={{
        position: "absolute",
        left: x - radius,
        top:  y - radius,
        willChange: "transform",
      }}
    >
      {/* Inner: gentle float animation */}
      <div style={{
        animation: `bubbleFloat ${dur}s ease-in-out ${delay}s infinite`,
        willChange: "transform",
      }}>
        <button
          ref={buttonRef}
          type="button"
          aria-label={`${name}, ${person.mugsCount} кружек`}
          onClick={() => onSelect(person)}
          onMouseEnter={() => { setShowTip(true);  onHoverStart?.(index); }}
          onMouseLeave={() => { setShowTip(false); onHoverEnd?.(index); }}
          onFocus={() => { setShowTip(true);  onHoverStart?.(index); }}
          onBlur={()  => { setShowTip(false); onHoverEnd?.(index); }}
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

        {/* Tooltip (desktop only) */}
        {!isMobile && showTip && (
          <div aria-hidden style={{
            position: "absolute",
            top: "50%", left: diameter + 10,
            transform: "translateY(-50%)",
            background: "rgba(21,49,38,0.95)",
            color: "#fff", borderRadius: 10,
            padding: "9px 14px", fontSize: 12,
            whiteSpace: "nowrap", pointerEvents: "none",
            boxShadow: "0 4px 20px rgba(0,0,0,0.25)", zIndex: 50,
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{name}</div>
            {handle && <div style={{ color: "#9dc9b0", marginBottom: 3, fontSize: 11 }}>{handle}</div>}
            <div style={{ color: "#c5e8d8", fontSize: 12 }}>
              {person.mugsCount} {person.mugsCount === 1 ? "кружка" : person.mugsCount < 5 ? "кружки" : "кружек"}
            </div>
            <div style={{
              position: "absolute", left: -4, top: "50%", transform: "translateY(-50%) rotate(45deg)",
              width: 8, height: 8, background: "rgba(21,49,38,0.95)",
            }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── PersonEditForm ────────────────────────────────────────────────────────────

function PersonEditForm({ person, language, onSaved, onCancel }) {
  const [form, setForm]           = useState({ first_name: person.first_name || "", last_name: person.last_name || "", instagram_url: person.instagram_url || "" });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [cropSource, setCropSource] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");

  useEffect(() => {
    if (!avatarFile) { setAvatarPreview(""); return; }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  async function save() {
    setSaving(true); setError("");
    try {
      let avatarPath = person.avatar_image_path;
      if (avatarFile) avatarPath = await uploadMugImage(avatarFile);
      const { error: err } = await supabase.from("people").update({
        first_name: form.first_name.trim(),
        last_name:  form.last_name.trim(),
        instagram_url: form.instagram_url.trim() || null,
        avatar_image_path: avatarPath || null,
      }).eq("id", person.id);
      if (err) throw err;
      onSaved({ ...person, ...form, avatar_image_path: avatarPath });
    } catch (e) {
      setError(e.message || "Ошибка при сохранении");
    } finally { setSaving(false); }
  }

  const currentAvatarUrl = avatarPreview || (person.avatar_image_path ? getMugImageUrl(person.avatar_image_path) : null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Avatar upload */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {currentAvatarUrl ? (
          <img src={currentAvatarUrl} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg,#1f6f54,#2d9970)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontWeight: 700, flexShrink: 0 }}>
            {getInitials(person)}
          </div>
        )}
        <label style={{ padding: "7px 14px", background: "#f5f0e8", border: "0.5px solid #e2ddd4", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
          {language === "en" ? "Change photo" : "Изменить фото"}
          <input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) setCropSource(f); }} />
        </label>
      </div>

      {cropSource && (
        <ImageCropperModal
          file={cropSource}
          language={language}
          onCancel={() => setCropSource(null)}
          onCrop={blob => { setAvatarFile(new File([blob], cropSource.name, { type: "image/png" })); setCropSource(null); }}
        />
      )}

      {/* Name fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700, color: "#31443a" }}>
          {language === "en" ? "First name" : "Имя"}
          <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
            placeholder={language === "en" ? "First name" : "Имя"}
            style={{ padding: "8px 12px", border: "1px solid #d7dfd8", borderRadius: 8, fontSize: 13, outline: "none" }} />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700, color: "#31443a" }}>
          {language === "en" ? "Last name" : "Фамилия"}
          <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
            placeholder={language === "en" ? "Last name" : "Фамилия"}
            style={{ padding: "8px 12px", border: "1px solid #d7dfd8", borderRadius: 8, fontSize: 13, outline: "none" }} />
        </label>
      </div>

      <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700, color: "#31443a" }}>
        Instagram
        <input value={form.instagram_url} onChange={e => setForm(f => ({ ...f, instagram_url: e.target.value }))}
          placeholder="https://instagram.com/username"
          style={{ padding: "8px 12px", border: "1px solid #d7dfd8", borderRadius: 8, fontSize: 13, outline: "none" }} />
      </label>

      {error && (
        <div style={{ padding: "10px 12px", background: "#fff3f3", border: "1px solid #f0d2d2", borderRadius: 8, color: "#9a2e2e", fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={save} disabled={saving} style={{
          flex: 2, padding: "10px", border: "none", borderRadius: 10,
          background: "#1f6f54", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          {saving ? (language === "en" ? "Saving…" : "Сохраняем…") : (language === "en" ? "Save" : "Сохранить")}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} style={{
          flex: 1, padding: "10px", border: "0.5px solid #e2ddd4", borderRadius: 10,
          background: "transparent", fontSize: 13, cursor: "pointer",
        }}>
          {language === "en" ? "Cancel" : "Отмена"}
        </button>
      </div>
    </div>
  );
}

// ── PersonModal ───────────────────────────────────────────────────────────────

// ── MugViewer — lightbox for a single mug's photos ───────────────────────────

function MugViewer({ mug, language, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const countryName = mug._countryName;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 700,
        background: "rgba(10,20,14,0.88)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fffaf4", borderRadius: 18,
        width: "100%", maxWidth: 400,
        overflow: "hidden",
        boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
        animation: "modalIn 0.2s ease",
      }}>
        {/* Carousel */}
        <div style={{ aspectRatio: "1/1", width: "100%", background: "#f5f0e8", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MugCarousel images={mug.mug_images || []} fallbackAlt={mug.title} />
          </div>
        </div>
        {/* Info */}
        <div style={{ padding: "14px 18px 18px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#153126", marginBottom: 3 }}>{mug.title}</div>
            <div style={{ fontSize: 12, color: "#8a9e96" }}>
              #{mug.collection_number}{countryName ? ` · ${countryName}` : ""}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{
            background: "#f5f0e8", border: "none", borderRadius: "50%",
            width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, color: "#5f6f66", cursor: "pointer", flexShrink: 0,
          }}>×</button>
        </div>
      </div>
    </div>
  );
}

// ── PersonModal ───────────────────────────────────────────────────────────────

function PersonModal({ person: initialPerson, mugs, countries, language, isAdmin, onClose, onRefresh }) {
  const [person, setPerson]   = useState(initialPerson);
  const [editMode, setEditMode] = useState(false);
  const [viewingMug, setViewingMug] = useState(null);
  const overlayRef = useRef(null);
  const closeRef   = useRef(null);

  const name      = getDisplayName(person);
  const handle    = parseHandle(person.instagram_url);
  const mugCount  = person.mugsCount;

  const personMugs = useMemo(() => mugs.filter(m => {
    const ids = Array.isArray(m.brought_by_person_ids) ? m.brought_by_person_ids
      : m.brought_by_person_id ? [m.brought_by_person_id] : [];
    return ids.includes(person.id);
  }), [mugs, person.id]);

  const visitedCountries = useMemo(() => {
    const seen = new Set();
    return personMugs.flatMap(m => {
      const c = countries.find(c => c.id === m.country_id);
      if (!c || seen.has(c.id)) return [];
      seen.add(c.id); return [c];
    });
  }, [personMugs, countries]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const prev = document.activeElement;
    closeRef.current?.focus();
    return () => { document.body.style.overflow = ""; prev?.focus?.(); };
  }, []);

  useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") {
        if (viewingMug) { setViewingMug(null); return; }
        if (editMode) { setEditMode(false); return; }
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, editMode, viewingMug]);

  function handleOverlay(e) { if (e.target === overlayRef.current && !editMode) onClose(); }

  function handleSaved(updated) {
    setPerson(prev => ({ ...prev, ...updated }));
    setEditMode(false);
    onRefresh?.();
  }

  return (
    <>
    <div ref={overlayRef} role="dialog" aria-modal="true" aria-labelledby="pm-name"
      onClick={handleOverlay}
      style={{
        position: "fixed", inset: 0, zIndex: 600,
        background: "rgba(15,30,20,0.48)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, animation: "modalBgIn 0.2s ease",
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fffaf4", borderRadius: 20,
        width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 24px 64px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06)",
        animation: "modalIn 0.22s ease",
        display: "flex", flexDirection: "column",
      }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "24px 24px 14px" }}>
          <div style={{ flexShrink: 0 }}>
            <AvatarCircle person={person} size={72} alt={name} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="pm-name" style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#153126" }}>{name}</h2>
            {handle && (
              <a href={person.instagram_url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13, color: "#1f6f54", fontWeight: 600, textDecoration: "none" }}>
                {handle}
              </a>
            )}
            <div style={{ marginTop: 6, fontSize: 13, color: "#5f6f66" }}>
              <strong style={{ color: "#153126" }}>{mugCount}</strong>{" "}
              {mugCount === 1 ? "кружка" : mugCount < 5 ? "кружки" : "кружек"}
              {visitedCountries.length > 0 && <>
                {" · "}<strong style={{ color: "#153126" }}>{visitedCountries.length}</strong>{" "}
                {language === "en" ? "countries" : "стран"}
              </>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {isAdmin && !editMode && (
              <button type="button" onClick={() => setEditMode(true)} style={{
                background: "#f5f0e8", border: "0.5px solid #e2ddd4", borderRadius: 8,
                padding: "5px 11px", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer",
              }}>
                ✎ {language === "en" ? "Edit" : "Изменить"}
              </button>
            )}
            <button ref={closeRef} type="button" onClick={onClose}
              aria-label={language === "en" ? "Close" : "Закрыть"}
              style={{
                background: "#f5f0e8", border: "none", borderRadius: "50%",
                width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, color: "#5f6f66", cursor: "pointer",
              }}>×</button>
          </div>
        </div>

        {/* Edit form */}
        {editMode && (
          <div style={{ padding: "0 24px 20px" }}>
            <div style={{ borderTop: "0.5px solid #e8e2d9", paddingTop: 18 }}>
              <PersonEditForm person={person} language={language}
                onSaved={handleSaved} onCancel={() => setEditMode(false)} />
            </div>
          </div>
        )}

        {/* View mode */}
        {!editMode && (
          <>
            {person.bio && (
              <p style={{ margin: "0 24px 14px", fontSize: 13, color: "#5f6f66", lineHeight: 1.65 }}>
                {person.bio}
              </p>
            )}

            {visitedCountries.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "0 24px 14px" }}>
                {visitedCountries.map(c => {
                  const cnt = personMugs.filter(m => m.country_id === c.id).length;
                  return (
                    <span key={c.id} style={{
                      padding: "3px 10px", borderRadius: 999,
                      background: "#e8f5ee", color: "#1a6340", fontSize: 12, fontWeight: 600,
                    }}>
                      {language === "en" ? c.name_en : c.name_ru} ({cnt})
                    </span>
                  );
                })}
              </div>
            )}

            <div style={{ borderTop: "0.5px solid #e8e2d9" }} />

            <div style={{ padding: "16px 24px 24px" }}>
              {personMugs.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "#8a9e96", fontSize: 13 }}>
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
                      const hasImages = (mug.mug_images?.length ?? 0) > 0;
                      const country = countries.find(c => c.id === mug.country_id);
                      const countryName = country ? (language === "en" ? country.name_en : country.name_ru) : null;
                      return (
                        <button
                          key={mug.id}
                          type="button"
                          onClick={() => setViewingMug({ ...mug, _countryName: countryName })}
                          style={{
                            borderRadius: 10, overflow: "hidden", background: "#f5f0e8",
                            border: "1px solid #e8e2d9", padding: 0, cursor: "pointer",
                            textAlign: "left",
                            transition: "transform 0.15s, box-shadow 0.15s",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 18px rgba(0,0,0,0.12)"; }}
                          onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
                        >
                          <div style={{ aspectRatio: "1/1", background: "#ede7dc", position: "relative" }}>
                            {imgUrl ? (
                              <img src={imgUrl} alt={mug.title} loading="lazy"
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                            ) : (
                              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc", fontSize: 20 }}>☕</div>
                            )}
                            {hasImages && mug.mug_images.length > 1 && (
                              <div style={{
                                position: "absolute", bottom: 4, right: 4,
                                background: "rgba(0,0,0,0.55)", color: "#fff",
                                fontSize: 9, fontWeight: 600, borderRadius: 4,
                                padding: "2px 5px",
                              }}>
                                1/{mug.mug_images.length}
                              </div>
                            )}
                          </div>
                          <div style={{ padding: "5px 7px" }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: "#153126", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {mug.title}
                            </div>
                            <div style={{ fontSize: 9, color: "#8a9e96", marginTop: 1 }}>#{mug.collection_number}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>

    {viewingMug && (
      <MugViewer mug={viewingMug} language={language} onClose={() => setViewingMug(null)} />
    )}
    </>
  );
}

// ── SizeLegend ────────────────────────────────────────────────────────────────

function SizeLegend({ language }) {
  const samples = [
    { r: 14, label: language === "en" ? "1 mug"  : "1 кружка" },
    { r: 22, label: language === "en" ? "~5"     : "~5 кружек" },
    { r: 32, label: language === "en" ? "~15"    : "~15 кружек" },
    { r: 44, label: language === "en" ? "~30+"   : "~30+ кружек" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "20px 16px 0" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
        {samples.map(s => (
          <div key={s.r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ width: s.r * 2, height: s.r * 2, borderRadius: "50%", background: "#e8e1d7", boxShadow: "0 0 0 2px rgba(255,255,255,0.8), 0 2px 8px rgba(0,0,0,0.1)" }} />
            <span style={{ fontSize: 10, color: "#8a9e96" }}>{s.label}</span>
          </div>
        ))}
      </div>
      <p style={{ textAlign: "center", fontSize: 12, color: "#8a9e96", margin: 0 }}>
        {language === "en" ? "The larger the photo, the more mugs gifted" : "Чем больше фото — тем больше подарено кружек"}
      </p>
    </div>
  );
}

// ── BubbleCloud ───────────────────────────────────────────────────────────────

function BubbleCloud({ people, mugs, countries, language, isAdmin, onSelect, onRefresh }) {
  const containerRef  = useRef(null);
  const outerRefs     = useRef([]);
  const buttonRefs    = useRef([]);
  const nodeDataRef   = useRef([]);  // { x, y, r }[] for wave math
  const hoveredIdxRef = useRef(-1);

  const [containerW, setContainerW] = useState(0);
  const [isMobile,   setIsMobile]   = useState(false);
  const [selected,   setSelected]   = useState(null);

  // Measure container
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

  // Enriched + sorted
  const enriched = useMemo(() => {
    return [...people]
      .map(p => ({ ...p, mugsCount: mugsByPerson[p.id] || 0 }))
      .sort((a, b) => b.mugsCount - a.mugsCount);
  }, [people, mugsByPerson]);

  // Layout
  const { nodes, height } = useMemo(() => {
    if (!containerW || !enriched.length) return { nodes: [], height: 320 };
    const maxCount = enriched[0]?.mugsCount ?? 1;
    const gap = isMobile ? GAP_MOBILE : GAP_DESKTOP;
    const withR = enriched.map(p => ({ person: p, radius: calcRadius(p.mugsCount, maxCount, isMobile) }));
    return fitToContainer(packBubbles(withR, gap), containerW);
  }, [enriched, containerW, isMobile]);

  // Keep nodeDataRef in sync
  useEffect(() => {
    nodeDataRef.current = nodes.map(n => ({ x: n.x, y: n.y, r: n.radius }));
    outerRefs.current.length = nodes.length;
    buttonRefs.current.length = nodes.length;
  }, [nodes]);

  // Wave animation + shadow (direct DOM, no re-render)
  const applyWave = useCallback((hovIdx) => {
    const nd = nodeDataRef.current;
    outerRefs.current.forEach((el, i) => {
      if (!el || !nd[i]) return;
      const btn = buttonRefs.current[i];
      if (i === hovIdx) {
        // Rise up with spring easing
        el.style.transform  = "translateY(-22px) scale(1.08)";
        el.style.transition = "transform 0.22s cubic-bezier(0.34,1.56,0.64,1)";
        el.style.zIndex     = "20";
        // Deep ground shadow — stays "below" while button lifts
        if (btn) {
          btn.style.boxShadow = "0 32px 56px rgba(21,49,38,0.42), 0 12px 20px rgba(0,0,0,0.2), 0 0 0 3px rgba(255,255,255,0.95)";
          btn.style.transition = "box-shadow 0.22s ease";
        }
      } else {
        // Push away from hovered bubble
        let px = 0, py = 0;
        if (hovIdx >= 0 && nd[hovIdx]) {
          const h = nd[hovIdx];
          const dx = nd[i].x - h.x, dy = nd[i].y - h.y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          const infl = h.r * 5;
          if (d < infl && d > 0) {
            const t  = (1 - d / infl) ** 1.5;
            px = (dx / d) * t * 24;
            py = (dy / d) * t * 24;
          }
        }
        el.style.transform  = (px || py) ? `translate(${px.toFixed(1)}px,${py.toFixed(1)}px)` : "";
        el.style.transition = "transform 0.3s ease";
        el.style.zIndex     = "1";
        // Restore normal shadow
        if (btn) {
          btn.style.boxShadow = "0 4px 14px rgba(21,49,38,0.16), 0 0 0 2.5px rgba(255,255,255,0.92)";
          btn.style.transition = "box-shadow 0.3s ease";
        }
      }
    });
  }, []);

  const handleHoverStart = useCallback((idx) => { hoveredIdxRef.current = idx; applyWave(idx); }, [applyWave]);
  const handleHoverEnd   = useCallback((idx) => {
    if (hoveredIdxRef.current === idx) { hoveredIdxRef.current = -1; applyWave(-1); }
  }, [applyWave]);

  const handleSelect = useCallback((person) => setSelected(person), []);
  const handleClose  = useCallback(() => setSelected(null), []);

  return (
    <>
      <div ref={containerRef} style={{ width: "100%" }}>
        {containerW > 0 && nodes.length > 0 && (
          <div style={{ position: "relative", width: "100%", height, overflow: "visible" }}>
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
        )}
      </div>

      {selected && (
        <PersonModal
          person={selected}
          mugs={mugs}
          countries={countries}
          language={language}
          isAdmin={isAdmin}
          onClose={handleClose}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}

// ── PeoplePage ────────────────────────────────────────────────────────────────

export default function PeoplePage({ people: peopleProp = [], mugs = [], countries = [], language = "ru", isAdmin = false, onRefresh }) {
  const visible = useMemo(
    () => (peopleProp ?? []).filter(p => p.is_visible !== false),
    [peopleProp],
  );

  return (
    <div style={{ background: "#faf7f3", minHeight: "100vh" }}>

      {/* Hero */}
      <div style={{ textAlign: "center", padding: "52px 24px 28px", maxWidth: 640, margin: "0 auto" }}>
        <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#1f6f54", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Starbucks Mug Collection
        </p>
        <h1 style={{ margin: "0 0 14px", fontSize: 32, fontWeight: 800, color: "#153126", lineHeight: 1.2 }}>
          {language === "en" ? "People Behind the Collection" : "Люди за коллекцией"}
        </h1>
        <p style={{ margin: "0 0 28px", fontSize: 14, color: "#5f6f66", lineHeight: 1.7 }}>
          {language === "en"
            ? `${visible.length} friends helped grow this collection across ${getCollectionYears()} years of travels.`
            : `${visible.length} друзей помогли собрать эту коллекцию за ${ruYears(getCollectionYears())} путешествий.`}
        </p>
        <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { n: visible.length, label: language === "en" ? "contributors" : "участников" },
            { n: mugs.length,    label: language === "en" ? "mugs"         : "кружек" },
            { n: getCollectionYears(), label: language === "en" ? "years" : "лет" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#153126", lineHeight: 1 }}>{s.n}</div>
              <div style={{ fontSize: 12, color: "#8a9e96", marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cloud */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px" }}>
        {visible.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#8a9e96" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>☕</div>
            <p style={{ fontSize: 14 }}>{language === "en" ? "No contributors yet." : "Пока нет участников."}</p>
          </div>
        ) : (
          <BubbleCloud
            people={visible}
            mugs={mugs}
            countries={countries}
            language={language}
            isAdmin={isAdmin}
            onRefresh={onRefresh}
          />
        )}
      </div>

      {visible.length > 0 && <SizeLegend language={language} />}
      <div style={{ height: 60 }} />

      {/* Global keyframe animations */}
      <style>{`
        @keyframes bubbleFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-7px); }
        }
        @keyframes bubbleFadeIn {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes modalBgIn {
          from { opacity: 0; } to { opacity: 1; }
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
