import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  async function loadAll() {
    setLoading(true);
    setError("");

    const [peopleResult, mugsResult] = await Promise.all([
      supabase
        .from("people")
        .select("id, first_name, last_name, bio, avatar_image_path, instagram_url, is_visible")
        .order("first_name", { ascending: true }),

      supabase
        .from("mugs")
        .select("id, brought_by_person_id, brought_by_person_ids, title"),
    ]);

    if (peopleResult.error) {
      setError(peopleResult.error.message);
      setLoading(false);
      return;
    }

    if (mugsResult.error) {
      setError(mugsResult.error.message);
      setLoading(false);
      return;
    }

    setPeople(peopleResult.data ?? []);
    setMugs(mugsResult.data ?? []);
    setLoading(false);
  }

  function openCreateForm() {
    setForm(emptyForm);
    setAvatarFile(null);
    setIsFormOpen(true);
    setError("");
  }

  function openEditForm(person) {
    setForm(person || emptyForm);
    setAvatarFile(null);
    setIsFormOpen(true);
    setError("");
  }

  function closeForm() {
    setForm(emptyForm);
    setAvatarFile(null);
    setIsFormOpen(false);
  }

  async function savePerson() {
    setSaving(true);
    setError("");

    try {
      if (!form.first_name.trim()) {
        throw new Error("Введите имя человека");
      }
      if (!form.last_name.trim()) {
        throw new Error("Введите фамилию человека");
      }

      let avatarPath = form.avatar_image_path;

      // Загружаем аватар если выбран новый файл
      if (avatarFile) {
        avatarPath = await uploadMugImage(avatarFile);
      }

      if (form.id) {
        // Редактирование
        const { error } = await supabase
          .from("people")
          .update({
            first_name: form.first_name,
            last_name: form.last_name,
            bio: form.bio,
            avatar_image_path: avatarPath,
            instagram_url: form.instagram_url || null,
            is_visible: form.is_visible,
          })
          .eq("id", form.id);

        if (error) throw error;
      } else {
        // Создание
        const { error } = await supabase
          .from("people")
          .insert({
            first_name: form.first_name,
            last_name: form.last_name,
            bio: form.bio,
            avatar_image_path: avatarPath,
            instagram_url: form.instagram_url || null,
            is_visible: form.is_visible,
          });

        if (error) throw error;
      }

      await loadAll();
      closeForm();
      await onChanged?.();
    } catch (err) {
      setError(err.message || "Ошибка при сохранении");
    } finally {
      setSaving(false);
    }
  }

  async function deletePerson(id) {
    if (!confirm("Удалить этого человека? Кружки не удалятся, но потеряют связь с человеком.")) return;

    setSaving(true);
    setError("");

    try {
      const { error } = await supabase.from("people").delete().eq("id", id);

      if (error) throw error;

      await loadAll();
      await onChanged?.();
    } catch (err) {
      setError(err.message || "Ошибка при удалении");
    } finally {
      setSaving(false);
    }
  }

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return people;

    return people.filter((person) => {
      return (
        person.first_name.toLowerCase().includes(q) ||
        person.last_name.toLowerCase().includes(q)
      );
    });
  }, [people, search]);

  const mugCountByPerson = useMemo(() => {
    const counts = {};

    mugs.forEach((mug) => {
      const personIds = Array.isArray(mug.brought_by_person_ids)
        ? mug.brought_by_person_ids
        : mug.brought_by_person_id
        ? [mug.brought_by_person_id]
        : [];

      personIds.forEach((personId) => {
        if (!personId) return;
        counts[personId] = (counts[personId] ?? 0) + 1;
      });
    });

    return counts;
  }, [mugs]);

  if (loading) {
    return (
      <section className="card admin-card">
        <div className="admin-toolbar">
          <div>
            <div className="section-title">Администрирование людей</div>
            <p className="admin-subtitle">Загрузка...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="card admin-card">
      <div className="admin-toolbar">
        <div>
          <div className="section-title">Администрирование людей</div>
          <p className="admin-subtitle">
            Добавляйте людей, которые привезли вам кружки в коллекцию
          </p>
        </div>

        <div className="admin-actions">
          <input
            className="admin-search"
            type="text"
            placeholder="Поиск по имени или фамилии"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button
            className="primary-button"
            onClick={openCreateForm}
            type="button"
            disabled={saving}
          >
            + Новый человек
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "12px",
            background: "#fee",
            border: "1px solid #fcc",
            borderRadius: "8px",
            color: "#c00",
            marginBottom: "12px",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      {isFormOpen && (
        <div
          style={{
            background: "#f9f7f3",
            border: "2px solid #e2e8e3",
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0" }}>
            {form.id ? "Редактировать" : "Новый человек"}
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            <div>
              <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: 600 }}>
                Имя *
              </label>
              <input
                type="text"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                placeholder="Введите имя"
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #d5ddd7",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: 600 }}>
                Фамилия *
              </label>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                placeholder="Введите фамилию"
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #d5ddd7",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: 600 }}>
              Фотография профиля
            </label>
            {form.avatar_image_path && !avatarFile && (
              <div style={{ marginBottom: "8px", width: "100px", aspectRatio: "1 / 1" }}>
                <img
                  src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/mug-images/${form.avatar_image_path}`}
                  alt="Текущая фотография"
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "8px",
                    objectFit: "cover",
                  }}
                />
              </div>
            )}
            {avatarPreviewUrl && (
              <div style={{ marginBottom: "12px", width: "120px", aspectRatio: "1 / 1" }}>
                <img
                  src={avatarPreviewUrl}
                  alt="Предпросмотр"
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "8px",
                    objectFit: "cover",
                  }}
                />
              </div>
            )}
            <label
              style={{
                display: "inline-block",
                padding: "8px 14px",
                background: "#e8e1d7",
                border: "1px solid #d5ddd7",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              Выбрать фото
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (file) {
                    setCropSourceFile(file);
                  }
                }}
              />
            </label>
            {cropSourceFile && (
              <ImageCropper
                file={cropSourceFile}
                onCancel={() => setCropSourceFile(null)}
                onCrop={(croppedFile) => {
                  setAvatarFile(croppedFile);
                  setCropSourceFile(null);
                }}
              />
            )}
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: 600 }}>
              О человеке (биография)
            </label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Расскажите о человеке..."
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid #d5ddd7",
                fontFamily: "inherit",
                boxSizing: "border-box",
                minHeight: "80px",
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: 600 }}>
              Instagram профиль
            </label>
            <input
              type="url"
              value={form.instagram_url}
              onChange={(e) => setForm({ ...form, instagram_url: e.target.value })}
              placeholder="https://instagram.com/username"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid #d5ddd7",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={form.is_visible}
                onChange={(e) =>
                  setForm({ ...form, is_visible: e.target.checked })
                }
              />
              <span>Видимо публично</span>
            </label>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="primary-button"
              onClick={savePerson}
              disabled={saving}
              type="button"
            >
              {saving ? "Сохраняем..." : "Сохранить"}
            </button>

            <button
              className="secondary-button"
              onClick={closeForm}
              disabled={saving}
              type="button"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "12px",
        }}
      >
        {filteredPeople.map((person) => (
          <div
            key={person.id}
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8e3",
              borderRadius: "12px",
              padding: "12px",
              display: "flex",
              gap: "12px",
            }}
          >
            {person.avatar_image_path && (
              <img
                src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/mug-images/${person.avatar_image_path}`}
                alt={`${person.first_name} ${person.last_name}`}
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "8px",
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 style={{ margin: "0 0 4px 0", fontSize: "14px" }}>
                {person.first_name} {person.last_name}
              </h4>

              <p
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "13px",
                  color: "#2F7D57",
                  fontWeight: 600,
                }}
              >
                {mugCountByPerson[person.id] ?? 0} кружек в коллекции
              </p>

              {person.bio && (
                <p
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: "12px",
                    color: "#666",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {person.bio}
                </p>
              )}

              {person.instagram_url && (
                <a
                  href={person.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "12px",
                    color: "#E4405F",
                    textDecoration: "none",
                    marginBottom: "8px",
                  }}
                >
                  📷 Instagram
                </a>
              )}

              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  className="secondary-button"
                  onClick={() => openEditForm(person)}
                  style={{ flex: 1, padding: "6px", fontSize: "12px" }}
                  disabled={saving}
                  type="button"
                >
                  Редактировать
                </button>

                <button
                  className="danger-button"
                  onClick={() => deletePerson(person.id)}
                  style={{ flex: 1, padding: "6px", fontSize: "12px" }}
                  disabled={saving}
                  type="button"
                >
                  Удалить
                </button>
              </div>

              <div
                style={{
                  marginTop: "8px",
                  padding: "8px",
                  background: "#f5efe6",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "#666",
                }}
              >
                {person.is_visible ? "✓ Видимо" : "✗ Скрыто"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredPeople.length === 0 && (
        <div
          style={{
            padding: "40px 20px",
            textAlign: "center",
            color: "#999",
          }}
        >
          <p>Люди не найдены</p>
        </div>
      )}
    </section>
  );
}

export default PeopleAdmin;
