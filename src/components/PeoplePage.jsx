import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { uploadMugImage } from "../lib/storage";
import ImageCropper from "./ImageCropper";

// ── helpers ───────────────────────────────────────────────────────────────────

function parseHandle(url) {
  if (!url) return null;
  try {
    const path = new URL(url).pathname.replace(/\/$/, "");
    const h = path.split("/").filter(Boolean).pop();
    return h ? `@${h}` : null;
  } catch {
    const c = url.replace(/^@/, "").trim();
    return c ? `@${c}` : null;
  }
}

function getDisplayName(person) {
  const name = [person.first_name, person.last_name].filter(Boolean).join(" ");
  return name || parseHandle(person.instagram_url) || "Без имени";
}

function getInitials(person) {
  if (person.first_name || person.last_name) {
    return [person.first_name?.[0], person.last_name?.[0]].filter(Boolean).join("").toUpperCase();
  }
  const h = parseHandle(person.instagram_url);
  return h?.[1]?.toUpperCase() || "?";
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ person, size = 80 }) {
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (person.avatar_image_path) {
    return (
      <img
        src={`${base}/storage/v1/object/public/mug-images/${person.avatar_image_path}`}
        alt={getDisplayName(person)}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "#1f6f54", color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: 700,
    }}>
      {getInitials(person)}
    </div>
  );
}

// ── PersonModal — detail + edit in one ───────────────────────────────────────

function PersonModal({ person, mugs, countries, language, isAdmin, onClose, onSaved, onDeleted }) {
  const [mode, setMode] = useState("view"); // "view" | "edit"
  const [form, setForm] = useState({ ...person });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [cropSource, setCropSource] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const base = import.meta.env.VITE_SUPABASE_URL;
  const handle = parseHandle(person.instagram_url);
  const displayName = getDisplayName(person);

  // Person's mugs
  const personMugs = useMemo(() => mugs.filter(m => {
    const ids = Array.isArray(m.brought_by_person_ids) ? m.brought_by_person_ids
      : m.brought_by_person_id ? [m.brought_by_person_id] : [];
    return ids.includes(person.id);
  }), [mugs, person.id]);

  // Countries
  const visitedCountries = useMemo(() => {
    const seen = new Set();
    return personMugs.map(m => {
      const c = countries.find(c => c.id === m.country_id);
      if (!c || seen.has(c.id)) return null;
      seen.add(c.id);
      return c;
    }).filter(Boolean);
  }, [personMugs, countries]);

  useEffect(() => {
    if (!avatarFile) { setAvatarPreview(""); return; }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);

  async function save() {
    setSaving(true); setError("");
    try {
      let avatarPath = form.avatar_image_path;
      if (avatarFile) avatarPath = await uploadMugImage(avatarFile);
      const { error } = await supabase.from("people").update({
        first_name: form.first_name?.trim() || "",
        last_name: form.last_name?.trim() || "",
        bio: form.bio?.trim() || "",
        instagram_url: form.instagram_url?.trim() || null,
        avatar_image_path: avatarPath || null,
        is_visible: form.is_visible,
      }).eq("id", person.id);
      if (error) throw error;
      onSaved?.();
      onClose();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function doDelete() {
    setDeleting(true);
    try {
      const { error } = await supabase.from("people").delete().eq("id", person.id);
      if (error) throw error;
      onDeleted?.();
      onClose();
    } catch (err) { setError(err.message); setDeleting(false); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: 560,
        maxHeight: "90vh", overflow: "auto", display: "flex", flexDirection: "column",
      }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "24px 24px 16px" }}>
          <Avatar person={mode === "edit" ? { ...person, ...form } : person} size={64} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#153126" }}>{displayName}</div>
            {handle && (
              <a href={person.instagram_url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13, color: "#1f6f54", fontWeight: 600, textDecoration: "none" }}>
                {handle}
              </a>
            )}
            <div style={{ fontSize: 12, color: "#8a9e96", marginTop: 2 }}>
              {personMugs.length} кружек · {visitedCountries.length} {language === "en" ? "countries" : "стран"}
            </div>
          </div>
          <button onClick={onClose} type="button" style={{ background: "none", border: "none", fontSize: 22, color: "#9ca3af", cursor: "pointer" }}>×</button>
        </div>

        {/* Country tags */}
        {visitedCountries.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "0 24px 16px" }}>
            {visitedCountries.map(c => (
              <span key={c.id} style={{ padding: "3px 10px", borderRadius: 999, background: "#e8f5ee", color: "#1a6340", fontSize: 12, fontWeight: 600 }}>
                {language === "en" ? c.name_en : c.name_ru} ({personMugs.filter(m => m.country_id === c.id).length})
              </span>
            ))}
          </div>
        )}

        <div style={{ borderTop: "0.5px solid #e8e2d9" }} />

        {mode === "view" ? (
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Bio */}
            {person.bio && (
              <p style={{ margin: 0, fontSize: 13, color: "#5f6f66", lineHeight: 1.6 }}>{person.bio}</p>
            )}

            {/* Mugs grid */}
            {personMugs.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#31443a", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
                  Кружки
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8 }}>
                  {personMugs.map(mug => {
                    const img = mug.mug_images?.[0];
                    return (
                      <div key={mug.id} style={{ borderRadius: 8, overflow: "hidden", background: "#f5f0e8" }}>
                        {img ? (
                          <img
                            src={`${base}/storage/v1/object/public/mug-images/${img.storage_path}`}
                            alt={mug.title}
                            style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }}
                          />
                        ) : (
                          <div style={{ aspectRatio: "1/1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#aaa" }}>
                            #{mug.collection_number}
                          </div>
                        )}
                        <div style={{ padding: "4px 6px", fontSize: 10, color: "#5f6f66", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          #{mug.collection_number}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            {isAdmin && (
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => setMode("edit")} style={{
                  flex: 1, padding: "9px", border: "0.5px solid #e2ddd4", borderRadius: 10,
                  background: "transparent", color: "#374151", fontSize: 13, fontWeight: 500, cursor: "pointer",
                }}>✎ Редактировать</button>
                {!confirmDelete ? (
                  <button type="button" onClick={() => setConfirmDelete(true)} style={{
                    padding: "9px 14px", border: "0.5px solid #f0d2d2", borderRadius: 10,
                    background: "transparent", color: "#c0392b", fontSize: 13, cursor: "pointer",
                  }}>🗑</button>
                ) : (
                  <div style={{ display: "flex", gap: 6, flex: 1 }}>
                    <button type="button" onClick={doDelete} disabled={deleting} style={{
                      flex: 1, padding: "9px", border: "none", borderRadius: 10,
                      background: "#c0392b", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}>{deleting ? "..." : "Удалить"}</button>
                    <button type="button" onClick={() => setConfirmDelete(false)} style={{
                      flex: 1, padding: "9px", border: "0.5px solid #e2ddd4", borderRadius: 10,
                      background: "transparent", fontSize: 12, cursor: "pointer",
                    }}>Отмена</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Edit form */
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Avatar upload */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar person={{ ...person, ...form, avatar_image_path: avatarPreview ? null : form.avatar_image_path }} size={56} />
              {avatarPreview && <img src={avatarPreview} alt="" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }} />}
              <label style={{ padding: "7px 14px", background: "#f5f0e8", border: "0.5px solid #e2ddd4", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
                Выбрать фото
                <input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) setCropSource(f); }} />
              </label>
            </div>

            {cropSource && (
              <ImageCropper file={cropSource} onCancel={() => setCropSource(null)}
                onCrop={f => { setAvatarFile(f); setCropSource(null); }} />
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "#31443a" }}>
                Имя
                <input type="text" value={form.first_name || ""} onChange={e => setForm({ ...form, first_name: e.target.value })}
                  placeholder="Имя" style={{ padding: "8px 12px", border: "1px solid #d7dfd8", borderRadius: 8, fontSize: 13 }} />
              </label>
              <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "#31443a" }}>
                Фамилия
                <input type="text" value={form.last_name || ""} onChange={e => setForm({ ...form, last_name: e.target.value })}
                  placeholder="Фамилия" style={{ padding: "8px 12px", border: "1px solid #d7dfd8", borderRadius: 8, fontSize: 13 }} />
              </label>
            </div>

            <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "#31443a" }}>
              Instagram
              <input type="text" value={form.instagram_url || ""} onChange={e => setForm({ ...form, instagram_url: e.target.value })}
                placeholder="https://instagram.com/username" style={{ padding: "8px 12px", border: "1px solid #d7dfd8", borderRadius: 8, fontSize: 13 }} />
            </label>

            <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "#31443a" }}>
              О человеке
              <textarea value={form.bio || ""} onChange={e => setForm({ ...form, bio: e.target.value })}
                placeholder="Биография..." rows={3}
                style={{ padding: "8px 12px", border: "1px solid #d7dfd8", borderRadius: 8, fontSize: 13, fontFamily: "inherit", resize: "vertical" }} />
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={form.is_visible ?? true} onChange={e => setForm({ ...form, is_visible: e.target.checked })} />
              Видимо публично
            </label>

            {error && <div style={{ padding: "10px 12px", background: "#fff3f3", border: "1px solid #f0d2d2", borderRadius: 8, color: "#9a2e2e", fontSize: 13 }}>{error}</div>}

            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={save} disabled={saving} style={{
                flex: 2, padding: "10px", border: "none", borderRadius: 10,
                background: "#1f6f54", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>{saving ? "Сохраняем..." : "Сохранить"}</button>
              <button type="button" onClick={() => setMode("view")} style={{
                flex: 1, padding: "10px", border: "0.5px solid #e2ddd4", borderRadius: 10,
                background: "transparent", fontSize: 13, cursor: "pointer",
              }}>Отмена</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PeoplePage ────────────────────────────────────────────────────────────────

function PeoplePage({ mugs = [], countries = [], isAdmin = false, language = "ru" }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({ first_name: "", last_name: "", instagram_url: "", bio: "", is_visible: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("people")
      .select("id, first_name, last_name, bio, avatar_image_path, instagram_url, is_visible")
      .order("first_name", { ascending: true });
    setPeople(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const mugsByPerson = useMemo(() => {
    const m = {};
    mugs.forEach(mug => {
      const ids = Array.isArray(mug.brought_by_person_ids) ? mug.brought_by_person_ids
        : mug.brought_by_person_id ? [mug.brought_by_person_id] : [];
      ids.forEach(id => { if (!id) return; if (!m[id]) m[id] = []; m[id].push(mug); });
    });
    return m;
  }, [mugs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter(p =>
      p.first_name?.toLowerCase().includes(q) ||
      p.last_name?.toLowerCase().includes(q) ||
      p.instagram_url?.toLowerCase().includes(q)
    );
  }, [people, search]);

  async function addPerson() {
    setSaving(true); setError("");
    try {
      const { error } = await supabase.from("people").insert({
        first_name: newForm.first_name.trim(),
        last_name: newForm.last_name.trim(),
        bio: newForm.bio.trim(),
        instagram_url: newForm.instagram_url.trim() || null,
        is_visible: newForm.is_visible,
      });
      if (error) throw error;
      setShowAdd(false);
      setNewForm({ first_name: "", last_name: "", instagram_url: "", bio: "", is_visible: true });
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  const base = import.meta.env.VITE_SUPABASE_URL;

  return (
    <main style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
      <section className="card" style={{ padding: 24 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700, color: "#153126" }}>
              {language === "en" ? "People in my collection" : "Люди в моей коллекции"}
            </h1>
            <p style={{ margin: 0, color: "#8a9e96", fontSize: 13 }}>
              {people.filter(p => p.is_visible).length} {language === "en" ? "people helped build this collection" : "человек помогли собрать эту коллекцию"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={language === "en" ? "Search..." : "Поиск по имени или @handle"}
              style={{ padding: "8px 14px", border: "1px solid #e2ddd4", borderRadius: 10, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
            {isAdmin && (
              <button type="button" onClick={() => setShowAdd(true)} style={{
                padding: "8px 16px", border: "none", borderRadius: 10,
                background: "#1f6f54", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
              }}>+ Добавить</button>
            )}
          </div>
        </div>

        {/* Add form */}
        {showAdd && isAdmin && (
          <div style={{ marginBottom: 20, padding: 16, background: "#f5f0e8", borderRadius: 14, border: "0.5px solid #e8e2d9" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#153126", marginBottom: 12 }}>Новый человек</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <input type="text" value={newForm.first_name} onChange={e => setNewForm({ ...newForm, first_name: e.target.value })}
                placeholder="Имя" style={{ padding: "8px 12px", border: "1px solid #d7dfd8", borderRadius: 8, fontSize: 13 }} />
              <input type="text" value={newForm.last_name} onChange={e => setNewForm({ ...newForm, last_name: e.target.value })}
                placeholder="Фамилия" style={{ padding: "8px 12px", border: "1px solid #d7dfd8", borderRadius: 8, fontSize: 13 }} />
            </div>
            <input type="text" value={newForm.instagram_url} onChange={e => setNewForm({ ...newForm, instagram_url: e.target.value })}
              placeholder="https://instagram.com/username"
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #d7dfd8", borderRadius: 8, fontSize: 13, boxSizing: "border-box", marginBottom: 10 }} />
            {error && <div style={{ color: "#c0392b", fontSize: 12, marginBottom: 8 }}>{error}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={addPerson} disabled={saving} style={{
                padding: "8px 20px", border: "none", borderRadius: 8,
                background: "#1f6f54", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>{saving ? "..." : "Сохранить"}</button>
              <button type="button" onClick={() => setShowAdd(false)} style={{
                padding: "8px 16px", border: "0.5px solid #e2ddd4", borderRadius: 8,
                background: "transparent", fontSize: 13, cursor: "pointer",
              }}>Отмена</button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#8a9e96" }}>Загрузка...</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
            {filtered.map(person => {
              const personMugs = mugsByPerson[person.id] ?? [];
              const handle = parseHandle(person.instagram_url);
              const name = getDisplayName(person);
              return (
                <div key={person.id} onClick={() => setSelected(person)}
                  style={{
                    background: "#f9f7f3", borderRadius: 14, overflow: "hidden",
                    cursor: "pointer", border: "1px solid #e8e2d9",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.09)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  {/* Photo */}
                  <div style={{ aspectRatio: "1/1", background: "#e8e1d7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {person.avatar_image_path ? (
                      <img src={`${base}/storage/v1/object/public/mug-images/${person.avatar_image_path}`}
                        alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#1f6f54", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700 }}>
                        {getInitials(person)}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#153126", marginBottom: 2 }}>{name}</div>
                    {handle && (
                      <div style={{ fontSize: 11, color: "#1f6f54", fontWeight: 600, marginBottom: 4 }}>{handle}</div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 6, borderTop: "0.5px solid #e8e2d9" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#1f6f54" }}>
                        {personMugs.length} {personMugs.length === 1 ? "кружка" : personMugs.length < 5 ? "кружки" : "кружек"}
                      </span>
                      <span style={{ fontSize: 16, color: "#c8bfb0" }}>→</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filtered.length === 0 && !loading && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#8a9e96" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>👤</div>
            <p>Никого не найдено</p>
          </div>
        )}
      </section>

      {selected && (
        <PersonModal
          person={selected}
          mugs={mugs}
          countries={countries}
          language={language}
          isAdmin={isAdmin}
          onClose={() => setSelected(null)}
          onSaved={async () => { await load(); }}
          onDeleted={async () => { await load(); }}
        />
      )}
    </main>
  );
}

export default PeoplePage;
