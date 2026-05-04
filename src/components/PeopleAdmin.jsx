import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { uploadMugImage } from "../lib/storage";
import ImageCropper from "./ImageCropper";

const emptyForm = {
  id: null,
  first_name: "",
  last_name: "",
  bio: "",
  instagram_url: "",
  avatar_image_path: "",
  is_visible: true,
};

// Parse instagram.com/handle → @handle
function parseInstagramHandle(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, "");
    const handle = path.split("/").filter(Boolean).pop();
    return handle ? `@${handle}` : null;
  } catch {
    // maybe it's just a handle already
    const clean = url.replace(/^@/, "").trim();
    return clean ? `@${clean}` : null;
  }
}

// Initials avatar
function Avatar({ person, size = 56 }) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (person.avatar_image_path) {
    return (
      <img
        src={`${supabaseUrl}/storage/v1/object/public/mug-images/${person.avatar_image_path}`}
        alt={`${person.first_name} ${person.last_name}`}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  const initials = [person.first_name?.[0], person.last_name?.[0]].filter(Boolean).join("").toUpperCase()
    || parseInstagramHandle(person.instagram_url)?.[1]?.toUpperCase() || "?";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "#1f6f54", color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 700,
    }}>
      {initials}
    </div>
  );
}

// Drawer component
function Drawer({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  useEffect(() => {
    function handleKey(e) { if (e.key === "Escape") onClose(); }
    if (isOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 200 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 201,
        width: "min(480px, 100vw)", background: "#fff",
        boxShadow: "-8px 0 40px rgba(0,0,0,0.12)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "0.5px solid #e8e2d9", flexShrink: 0 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: "#153126" }}>{title}</span>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9ca3af", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>{children}</div>
      </div>
    </>
  );
}

function PeopleAdmin({ onChanged }) {
  const [people, setPeople] = useState([]);
  const [mugs, setMugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [cropSourceFile, setCropSourceFile] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!avatarFile) { setAvatarPreviewUrl(""); return; }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  async function loadAll() {
    setLoading(true); setError("");
    const [peopleRes, mugsRes] = await Promise.all([
      supabase.from("people").select("id, first_name, last_name, bio, avatar_image_path, instagram_url, is_visible").order("first_name", { ascending: true }),
      supabase.from("mugs").select("id, collection_number, title, brought_by_person_id, brought_by_person_ids"),
    ]);
    if (peopleRes.error) { setError(peopleRes.error.message); setLoading(false); return; }
    setPeople(peopleRes.data ?? []);
    setMugs(mugsRes.error ? [] : mugsRes.data ?? []);
    setLoading(false);
  }

  function openCreateForm() { setForm(emptyForm); setAvatarFile(null); setIsFormOpen(true); setError(""); }
  function openEditForm(person) { setForm({ ...emptyForm, ...person }); setAvatarFile(null); setIsFormOpen(true); setError(""); }
  function closeForm() { setForm(emptyForm); setAvatarFile(null); setIsFormOpen(false); setError(""); }

  async function savePerson() {
    setSaving(true); setError("");
    try {
      let avatarPath = form.avatar_image_path;
      if (avatarFile) avatarPath = await uploadMugImage(avatarFile);

      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        bio: form.bio.trim(),
        avatar_image_path: avatarPath || null,
        instagram_url: form.instagram_url.trim() || null,
        is_visible: form.is_visible,
      };

      if (form.id) {
        const { error } = await supabase.from("people").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("people").insert(payload);
        if (error) throw error;
      }

      await loadAll(); closeForm(); await onChanged?.();
    } catch (err) {
      setError(err.message || "Ошибка при сохранении");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(id) {
    setSaving(true); setError("");
    try {
      const { error } = await supabase.from("people").delete().eq("id", id);
      if (error) throw error;
      setDeleteConfirmId(null);
      await loadAll(); await onChanged?.();
    } catch (err) {
      setError(err.message || "Ошибка при удалении");
    } finally {
      setSaving(false);
    }
  }

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter(p =>
      p.first_name?.toLowerCase().includes(q) ||
      p.last_name?.toLowerCase().includes(q) ||
      p.instagram_url?.toLowerCase().includes(q)
    );
  }, [people, search]);

  const mugsByPerson = useMemo(() => {
    const map = {};
    mugs.forEach(mug => {
      const ids = Array.isArray(mug.brought_by_person_ids) ? mug.brought_by_person_ids
        : mug.brought_by_person_id ? [mug.brought_by_person_id] : [];
      ids.forEach(id => {
        if (!id) return;
        if (!map[id]) map[id] = [];
        map[id].push(mug);
      });
    });
    return map;
  }, [mugs]);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  if (loading) return (
    <section className="card admin-card">
      <div className="admin-toolbar"><div><div className="section-title">Люди</div><p className="admin-subtitle">Загрузка...</p></div></div>
    </section>
  );

  return (
    <section className="card admin-card">
      {/* Toolbar */}
      <div className="admin-toolbar">
        <div>
          <div className="section-title">Люди</div>
          <p className="admin-subtitle">{people.length} человек · {people.filter(p => p.is_visible).length} видимых</p>
        </div>
        <div className="admin-actions">
          <input className="admin-search" type="text" placeholder="Поиск по имени или @handle"
            value={search} onChange={e => setSearch(e.target.value)} />
          <button className="primary-button" onClick={openCreateForm} type="button" disabled={saving}>
            + Добавить
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "#fff3f3", border: "1px solid #f0d2d2", borderRadius: 10, color: "#9a2e2e", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* People grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {filteredPeople.map(person => {
          const personMugs = mugsByPerson[person.id] ?? [];
          const handle = parseInstagramHandle(person.instagram_url);
          const displayName = [person.first_name, person.last_name].filter(Boolean).join(" ") || handle || "Без имени";
          const isDeleting = deleteConfirmId === person.id;

          return (
            <div key={person.id} style={{
              background: "#fff", border: "1px solid #e8e2d9", borderRadius: 14,
              padding: 16, display: "flex", flexDirection: "column", gap: 10,
            }}>
              {/* Header */}
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <Avatar person={person} size={52} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#153126" }}>{displayName}</div>
                  {handle && (
                    <a
                      href={person.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: "#1f6f54", fontWeight: 600, textDecoration: "none" }}
                    >
                      {handle}
                    </a>
                  )}
                  <div style={{ fontSize: 12, color: "#1f6f54", fontWeight: 600, marginTop: 2 }}>
                    {personMugs.length} {personMugs.length === 1 ? "кружка" : personMugs.length < 5 ? "кружки" : "кружек"}
                  </div>
                </div>
                <div style={{
                  fontSize: 10, padding: "2px 8px", borderRadius: 999,
                  background: person.is_visible ? "#e8f5ee" : "#f5f0e8",
                  color: person.is_visible ? "#1a6340" : "#8a9e96",
                  fontWeight: 600, flexShrink: 0,
                }}>
                  {person.is_visible ? "Видим" : "Скрыт"}
                </div>
              </div>

              {/* Bio */}
              {person.bio && (
                <p style={{ fontSize: 12, color: "#5f6f66", lineHeight: 1.5, margin: 0,
                  overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box",
                  WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {person.bio}
                </p>
              )}

              {/* Mugs list */}
              {personMugs.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {personMugs.slice(0, 8).map(mug => (
                    <span key={mug.id} style={{
                      fontSize: 11, padding: "2px 7px", borderRadius: 999,
                      background: "#f5f0e8", color: "#5f6f66",
                    }}>
                      #{mug.collection_number}
                    </span>
                  ))}
                  {personMugs.length > 8 && (
                    <span style={{ fontSize: 11, color: "#8a9e96" }}>+{personMugs.length - 8}</span>
                  )}
                </div>
              )}

              {/* Actions */}
              {!isDeleting ? (
                <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
                  <button type="button" onClick={() => openEditForm(person)} disabled={saving}
                    style={{
                      flex: 1, padding: "7px", border: "0.5px solid #e2ddd4", borderRadius: 8,
                      background: "transparent", color: "#374151", fontSize: 12, fontWeight: 500, cursor: "pointer",
                    }}>
                    ✎ Редактировать
                  </button>
                  <button type="button" onClick={() => setDeleteConfirmId(person.id)} disabled={saving}
                    style={{
                      padding: "7px 12px", border: "0.5px solid #f0d2d2", borderRadius: 8,
                      background: "transparent", color: "#c0392b", fontSize: 12, fontWeight: 500, cursor: "pointer",
                    }}>
                    🗑
                  </button>
                </div>
              ) : (
                <div style={{ background: "#fff3f3", border: "1px solid #f0d2d2", borderRadius: 8, padding: "10px 12px" }}>
                  <p style={{ fontSize: 12, color: "#9a2e2e", margin: "0 0 8px", fontWeight: 600 }}>Удалить {displayName}?</p>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => confirmDelete(person.id)} disabled={saving}
                      style={{ flex: 1, padding: "6px", border: "none", borderRadius: 6, background: "#c0392b", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      {saving ? "..." : "Удалить"}
                    </button>
                    <button type="button" onClick={() => setDeleteConfirmId(null)} disabled={saving}
                      style={{ flex: 1, padding: "6px", border: "0.5px solid #e2ddd4", borderRadius: 6, background: "transparent", color: "#374151", fontSize: 12, cursor: "pointer" }}>
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredPeople.length === 0 && (
        <div style={{ padding: "48px 20px", textAlign: "center", color: "#8a9e96" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👤</div>
          <p>Никого не найдено</p>
        </div>
      )}

      {/* Edit/Create Drawer */}
      <Drawer
        isOpen={isFormOpen}
        onClose={closeForm}
        title={form.id ? "Редактировать человека" : "Новый человек"}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Avatar */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#31443a", display: "block", marginBottom: 8 }}>Фото</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {(avatarPreviewUrl || form.avatar_image_path) ? (
                <img
                  src={avatarPreviewUrl || `${supabaseUrl}/storage/v1/object/public/mug-images/${form.avatar_image_path}`}
                  alt="Аватар"
                  style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }}
                />
              ) : (
                <div style={{
                  width: 64, height: 64, borderRadius: "50%", background: "#f5f0e8",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24, color: "#ccc",
                }}>👤</div>
              )}
              <label style={{
                padding: "7px 14px", background: "#f5f0e8", border: "0.5px solid #e2ddd4",
                borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500,
              }}>
                Выбрать фото
                <input type="file" accept="image/*" hidden onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) setCropSourceFile(file);
                }} />
              </label>
            </div>
            {cropSourceFile && (
              <ImageCropper file={cropSourceFile} onCancel={() => setCropSourceFile(null)}
                onCrop={croppedFile => { setAvatarFile(croppedFile); setCropSourceFile(null); }} />
            )}
          </div>

          {/* Name */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "#31443a" }}>
              Имя
              <input type="text" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })}
                placeholder="Имя" className="admin-search" style={{ margin: 0 }} />
            </label>
            <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "#31443a" }}>
              Фамилия
              <input type="text" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })}
                placeholder="Фамилия" className="admin-search" style={{ margin: 0 }} />
            </label>
          </div>

          {/* Instagram */}
          <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "#31443a" }}>
            Instagram
            <input type="text" value={form.instagram_url} onChange={e => setForm({ ...form, instagram_url: e.target.value })}
              placeholder="https://instagram.com/username" className="admin-search" style={{ margin: 0 }} />
          </label>

          {/* Bio */}
          <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "#31443a" }}>
            О человеке
            <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })}
              placeholder="Биография..." rows={3}
              style={{
                padding: "9px 12px", border: "1px solid #d7dfd8", borderRadius: 10,
                fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none",
              }} />
          </label>

          {/* Visibility */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={form.is_visible} onChange={e => setForm({ ...form, is_visible: e.target.checked })} />
            Видимо публично
          </label>

          {error && (
            <div style={{ padding: "10px 12px", background: "#fff3f3", border: "1px solid #f0d2d2", borderRadius: 8, color: "#9a2e2e", fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={savePerson} disabled={saving} className="primary-button" style={{ flex: 2 }}>
              {saving ? "Сохраняем..." : "Сохранить"}
            </button>
            <button type="button" onClick={closeForm} disabled={saving} className="secondary-button" style={{ flex: 1 }}>
              Отмена
            </button>
          </div>
        </div>
      </Drawer>
    </section>
  );
}

export default PeopleAdmin;
