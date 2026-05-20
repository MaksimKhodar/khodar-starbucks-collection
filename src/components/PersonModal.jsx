import { useEffect, useMemo, useRef, useState } from "react";
import { getMugImageUrl, uploadMugImage } from "../lib/storage";
import { supabase } from "../lib/supabase";
import ImageCropperModal from "./ImageCropperModal";
import MugCarousel from "./MugCarousel";

// ── Helpers ───────────────────────────────────────────────────────────────────

export function parseHandle(url) {
  if (!url) return null;
  try {
    const h = new URL(url).pathname.replace(/\/$/, "").split("/").filter(Boolean).pop();
    return h ? `@${h}` : null;
  } catch {
    const c = url.replace(/^@/, "").trim();
    return c ? `@${c}` : null;
  }
}

export function getDisplayName(p) {
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || parseHandle(p.instagram_url) || "—";
}

export function getInitials(p) {
  const n = [p.first_name?.[0], p.last_name?.[0]].filter(Boolean).join("").toUpperCase();
  return n || parseHandle(p.instagram_url)?.[1]?.toUpperCase() || "?";
}

// ── AvatarCircle ──────────────────────────────────────────────────────────────

export function AvatarCircle({ person, size, alt }) {
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

// ── PersonEditForm ────────────────────────────────────────────────────────────

function PersonEditForm({ person, language, onSaved, onCancel }) {
  const [form, setForm] = useState({
    first_name: person.first_name || "",
    last_name: person.last_name || "",
    instagram_url: person.instagram_url || "",
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [cropSource, setCropSource] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
        last_name: form.last_name.trim(),
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

// ── MugViewer ─────────────────────────────────────────────────────────────────

function MugViewer({ mug, language, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 700,
      background: "rgba(10,20,14,0.88)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fffaf4", borderRadius: 18,
        width: "100%", maxWidth: 400, overflow: "hidden",
        boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
        animation: "modalIn 0.2s ease",
      }}>
        <div style={{ aspectRatio: "1/1", width: "100%", background: "#f5f0e8", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MugCarousel images={mug.mug_images || []} fallbackAlt={mug.title} />
          </div>
        </div>
        <div style={{ padding: "14px 18px 18px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#153126", marginBottom: 3 }}>{mug.title}</div>
            <div style={{ fontSize: 12, color: "#8a9e96" }}>
              #{mug.collection_number}{mug._countryName ? ` · ${mug._countryName}` : ""}
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

export default function PersonModal({ person: initialPerson, mugs, countries, language, isAdmin, onClose, onRefresh }) {
  const [person, setPerson]               = useState(initialPerson);
  const [editMode, setEditMode]           = useState(false);
  const [viewingMug, setViewingMug]       = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [deleteError, setDeleteError]     = useState("");
  const overlayRef = useRef(null);
  const closeRef   = useRef(null);

  const name     = getDisplayName(person);
  const handle   = parseHandle(person.instagram_url);
  const mugCount = person.mugsCount;

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
        if (viewingMug)       { setViewingMug(null); return; }
        if (confirmDelete)    { setConfirmDelete(false); setDeleteError(""); return; }
        if (editMode)         { setEditMode(false); return; }
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, editMode, viewingMug, confirmDelete]);

  function handleOverlay(e) {
    if (e.target === overlayRef.current && !editMode && !confirmDelete) onClose();
  }

  function handleSaved(updated) {
    setPerson(prev => ({ ...prev, ...updated }));
    setEditMode(false);
    onRefresh?.();
  }

  async function handleDelete() {
    setDeleting(true); setDeleteError("");
    try {
      const { error: err } = await supabase.from("people").delete().eq("id", person.id);
      if (err) throw err;
      onRefresh?.();
      onClose();
    } catch (e) {
      setDeleteError(e.message || "Ошибка при удалении");
      setDeleting(false);
    }
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

              {/* Instagram link — styled as a visible badge */}
              {handle && (
                <a href={person.instagram_url} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5, marginTop: 5,
                    padding: "3px 10px 3px 8px", borderRadius: 999,
                    background: "linear-gradient(135deg,#f9e4f0,#fce8d5)",
                    border: "1px solid #f0c8d8",
                    fontSize: 12, fontWeight: 600, color: "#c2185b",
                    textDecoration: "none",
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = "0.8"; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                >
                  {/* Instagram icon */}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <circle cx="12" cy="12" r="4"/>
                    <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/>
                  </svg>
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
              {isAdmin && !editMode && !confirmDelete && (
                <>
                  <button type="button" onClick={() => setEditMode(true)} style={{
                    background: "#f5f0e8", border: "0.5px solid #e2ddd4", borderRadius: 8,
                    padding: "5px 11px", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer",
                  }}>
                    ✎ {language === "en" ? "Edit" : "Изменить"}
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(true)} style={{
                    background: "#fff5f5", border: "0.5px solid #f0c8c8", borderRadius: 8,
                    padding: "5px 11px", fontSize: 12, fontWeight: 600, color: "#9a2e2e", cursor: "pointer",
                  }}>🗑</button>
                </>
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

          {/* Delete confirmation */}
          {confirmDelete && (
            <div style={{ margin: "0 24px 16px", padding: "14px 16px", background: "#fff5f5", border: "1px solid #f0c8c8", borderRadius: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#7a2020", marginBottom: 10 }}>
                {language === "en"
                  ? `Delete "${name}"? This cannot be undone.`
                  : `Удалить «${name}»? Это действие необратимо.`}
              </div>
              {deleteError && <div style={{ fontSize: 12, color: "#9a2e2e", marginBottom: 8 }}>{deleteError}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={handleDelete} disabled={deleting} style={{
                  flex: 1, padding: "7px 0", border: "none", borderRadius: 8,
                  background: "#c0392b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  opacity: deleting ? 0.6 : 1,
                }}>
                  {deleting ? "…" : (language === "en" ? "Yes, delete" : "Да, удалить")}
                </button>
                <button type="button" onClick={() => { setConfirmDelete(false); setDeleteError(""); }} disabled={deleting} style={{
                  flex: 1, padding: "7px 0", border: "0.5px solid #e2ddd4", borderRadius: 8,
                  background: "transparent", fontSize: 13, cursor: "pointer",
                }}>
                  {language === "en" ? "Cancel" : "Отмена"}
                </button>
              </div>
            </div>
          )}

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
                        const country = countries.find(c => c.id === mug.country_id);
                        const countryName = country ? (language === "en" ? country.name_en : country.name_ru) : null;
                        return (
                          <button key={mug.id} type="button"
                            onClick={() => setViewingMug({ ...mug, _countryName: countryName })}
                            style={{
                              borderRadius: 10, overflow: "hidden", background: "#f5f0e8",
                              border: "1px solid #e8e2d9", padding: 0, cursor: "pointer", textAlign: "left",
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
                              {(mug.mug_images?.length ?? 0) > 1 && (
                                <div style={{
                                  position: "absolute", bottom: 4, right: 4,
                                  background: "rgba(0,0,0,0.55)", color: "#fff",
                                  fontSize: 9, fontWeight: 600, borderRadius: 4, padding: "2px 5px",
                                }}>1/{mug.mug_images.length}</div>
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
