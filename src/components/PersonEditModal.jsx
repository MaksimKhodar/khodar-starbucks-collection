import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { uploadMugImage } from "../lib/storage";
import ImageCropper from "./ImageCropper";

function PersonEditModal({ person, onClose, onUpdated, language = "ru" }) {
  const [form, setForm] = useState({
    first_name: person?.first_name || "",
    last_name: person?.last_name || "",
    bio: person?.bio || "",
    instagram_url: person?.instagram_url || "",
    avatar_image_path: person?.avatar_image_path || "",
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [cropSourceFile, setCropSourceFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const t = {
    ru: {
      editPerson: "Редактировать профиль",
      firstName: "Имя",
      lastName: "Фамилия",
      bio: "О человеке",
      instagram: "Instagram профиль",
      instagramPlaceholder: "https://instagram.com/username",
      photo: "Фотография профиля",
      selectPhoto: "Выбрать фото",
      save: "Сохранить",
      cancel: "Отмена",
      saving: "Сохраняем...",
      error: "Ошибка при сохранении",
    },
    en: {
      editPerson: "Edit Profile",
      firstName: "First Name",
      lastName: "Last Name",
      bio: "About",
      instagram: "Instagram Profile",
      instagramPlaceholder: "https://instagram.com/username",
      photo: "Profile Photo",
      selectPhoto: "Select Photo",
      save: "Save",
      cancel: "Cancel",
      saving: "Saving...",
      error: "Save error",
    },
  };

  const tr = t[language] || t.ru;

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  async function handleSave() {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError("Введите имя и фамилию");
      return;
    }

    setSaving(true);
    setError("");

    try {
      let avatarPath = form.avatar_image_path;

      if (avatarFile) {
        avatarPath = await uploadMugImage(avatarFile);
      }

      const { error } = await supabase
        .from("people")
        .update({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          bio: form.bio.trim(),
          instagram_url: form.instagram_url.trim() || null,
          avatar_image_path: avatarPath,
        })
        .eq("id", person.id);

      if (error) throw error;

      onUpdated?.();
      onClose();
    } catch (err) {
      setError(err.message || tr.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "20px",
          maxWidth: "500px",
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          padding: "30px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 20px 0", fontSize: "24px" }}>
          {tr.editPerson}
        </h2>

        {error && (
          <div
            style={{
              padding: "12px",
              background: "#fee",
              border: "1px solid #fcc",
              borderRadius: "8px",
              color: "#c00",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "grid", gap: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: 600 }}>
                {tr.firstName} *
              </label>
              <input
                type="text"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
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
              <label style={{ display: "block", marginBottom: "4px", fontWeight: 600 }}>
                {tr.lastName} *
              </label>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
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

          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 600 }}>
              {tr.bio}
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

          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 600 }}>
              {tr.instagram}
            </label>
            <input
              type="url"
              value={form.instagram_url}
              onChange={(e) => setForm({ ...form, instagram_url: e.target.value })}
              placeholder={tr.instagramPlaceholder}
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
            <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              {tr.photo}
            </label>

            {form.avatar_image_path && !avatarPreviewUrl && (
              <div style={{ marginBottom: "12px", width: "120px", aspectRatio: "1 / 1" }}>
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
                padding: "8px 16px",
                background: "#e8e1d7",
                border: "1px solid #d5ddd7",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              {tr.selectPhoto}
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
        </div>

        <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1,
              padding: "12px",
              background: "#2F7D57",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {saving ? tr.saving : tr.save}
          </button>

          <button
            onClick={onClose}
            disabled={saving}
            style={{
              flex: 1,
              padding: "12px",
              background: "#e8e1d7",
              border: "1px solid #d5ddd7",
              borderRadius: "8px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {tr.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PersonEditModal;