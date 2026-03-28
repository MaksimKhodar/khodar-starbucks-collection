import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import MugImagesManager from "./MugImagesManager";

const emptyForm = {
  id: null,
  slug: "",
  title: "",
  country_id: "",
  city: "",
  mug_type: "",
  received_at: "",
  brought_by: "",
  note: "",
  is_published: true,
};

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function MugsAdmin({ onChanged }) {
  const [mugs, setMugs] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError("");

    const [countriesResult, mugsResult] = await Promise.all([
      supabase
        .from("countries")
        .select("id, iso2_code, name_en, name_ru")
        .order("name_en", { ascending: true }),

      supabase
        .from("mugs")
        .select(`
          id,
          country_id,
          slug,
          title,
          city,
          mug_type,
          received_at,
          brought_by,
          note,
          is_published,
          country:countries (
            id,
            iso2_code,
            name_en,
            name_ru
          )
        `)
        .order("created_at", { ascending: false }),
    ]);

    if (countriesResult.error) {
      setError(countriesResult.error.message);
      setLoading(false);
      return;
    }

    if (mugsResult.error) {
      setError(mugsResult.error.message);
      setLoading(false);
      return;
    }

    setCountries(countriesResult.data ?? []);
    setMugs(mugsResult.data ?? []);
    setLoading(false);
  }

  function openCreateForm() {
    setForm(emptyForm);
    setIsFormOpen(true);
    setError("");
  }

  function openEditForm(mug) {
    setForm({
      id: mug.id,
      slug: mug.slug || "",
      title: mug.title || "",
      country_id: mug.country_id ? String(mug.country_id) : "",
      city: mug.city || "",
      mug_type: mug.mug_type || "",
      received_at: mug.received_at || "",
      brought_by: mug.brought_by || "",
      note: mug.note || "",
      is_published: !!mug.is_published,
    });
    setIsFormOpen(true);
    setError("");
  }

  function closeForm() {
    setForm(emptyForm);
    setIsFormOpen(false);
    setError("");
  }

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function saveForm(e) {
    e.preventDefault();

    if (!form.title.trim()) {
      setError("Укажите название кружки.");
      return;
    }

    if (!form.country_id) {
      setError("Выберите страну.");
      return;
    }

    setSaving(true);
    setError("");

    const baseSlug =
      form.slug.trim() ||
      slugify([form.title, form.city].filter(Boolean).join(" ")) ||
      `mug-${Date.now()}`;

    const payload = {
      slug: baseSlug,
      title: form.title.trim(),
      country_id: Number(form.country_id),
      city: form.city.trim() || null,
      mug_type: form.mug_type.trim() || null,
      received_at: form.received_at || null,
      brought_by: form.brought_by.trim() || null,
      note: form.note.trim() || null,
      is_published: !!form.is_published,
    };

    let result;

    if (form.id) {
      result = await supabase.from("mugs").update(payload).eq("id", form.id);
    } else {
      result = await supabase.from("mugs").insert(payload);
    }

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    await loadAll();
    await onChanged?.();

    closeForm();
    setSaving(false);
  }

  async function deleteMug(mugId) {
    const confirmed = window.confirm("Удалить эту кружку?");
    if (!confirmed) return;

    setError("");

    const { error } = await supabase.from("mugs").delete().eq("id", mugId);

    if (error) {
      setError(error.message);
      return;
    }

    await loadAll();
    await onChanged?.();
  }

  const filteredMugs = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return mugs;

    return mugs.filter((mug) => {
      return (
        (mug.title || "").toLowerCase().includes(q) ||
        (mug.slug || "").toLowerCase().includes(q) ||
        (mug.city || "").toLowerCase().includes(q) ||
        (mug.brought_by || "").toLowerCase().includes(q) ||
        (mug.country?.name_en || "").toLowerCase().includes(q) ||
        (mug.country?.name_ru || "").toLowerCase().includes(q)
      );
    });
  }, [mugs, search]);

  return (
    <section className="card admin-card">
      <div className="admin-toolbar">
        <div>
          <div className="section-title">Администрирование кружек</div>
          <p className="admin-subtitle">
            Здесь можно добавлять, редактировать и удалять кружки.
          </p>
        </div>

        <div className="admin-actions">
          <input
            className="admin-search"
            type="text"
            placeholder="Поиск по кружке, городу, стране"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="secondary-button" onClick={loadAll} type="button">
            Обновить
          </button>
          <button
            className="primary-button"
            onClick={openCreateForm}
            type="button"
          >
            Добавить кружку
          </button>
        </div>
      </div>

      {isFormOpen && (
        <form className="admin-form-card" onSubmit={saveForm}>
          <div className="admin-form-grid">
            <label className="field">
              <span>Название *</span>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateForm("title", e.target.value)}
                placeholder="Например: Starbucks Warsaw Mug"
              />
            </label>

            <label className="field">
              <span>Slug</span>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => updateForm("slug", e.target.value)}
                placeholder="Можно оставить пустым"
              />
            </label>

            <label className="field">
              <span>Страна *</span>
              <select
                value={form.country_id}
                onChange={(e) => updateForm("country_id", e.target.value)}
              >
                <option value="">Выберите страну</option>
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name_en}
                    {country.name_ru ? ` / ${country.name_ru}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Город</span>
              <input
                type="text"
                value={form.city}
                onChange={(e) => updateForm("city", e.target.value)}
                placeholder="Warsaw"
              />
            </label>

            <label className="field">
              <span>Тип</span>
              <input
                type="text"
                value={form.mug_type}
                onChange={(e) => updateForm("mug_type", e.target.value)}
                placeholder="local / been there / city mug"
              />
            </label>

            <label className="field">
              <span>Дата получения</span>
              <input
                type="date"
                value={form.received_at}
                onChange={(e) => updateForm("received_at", e.target.value)}
              />
            </label>

            <label className="field">
              <span>Кто привёз</span>
              <input
                type="text"
                value={form.brought_by}
                onChange={(e) => updateForm("brought_by", e.target.value)}
                placeholder="Maxim"
              />
            </label>

            <label className="checkbox-cell field-wide">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => updateForm("is_published", e.target.checked)}
              />
              <span>Опубликовано</span>
            </label>

            <label className="field field-wide">
              <span>Заметка</span>
              <textarea
                rows="4"
                value={form.note}
                onChange={(e) => updateForm("note", e.target.value)}
                placeholder="Любая дополнительная информация"
              />
            </label>
          </div>

          <MugImagesManager
            mugId={form.id}
            onChanged={async () => {
              await loadAll();
              await onChanged?.();
            }}
          />

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Сохраняем..." : form.id ? "Сохранить" : "Создать"}
            </button>

            <button
              className="secondary-button"
              type="button"
              onClick={closeForm}
              disabled={saving}
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="empty-state">
          <h2>Загрузка кружек…</h2>
          <p>Получаем данные из базы.</p>
        </div>
      ) : error ? (
        <div className="empty-state">
          <h2>Ошибка</h2>
          <p>{error}</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Страна</th>
                <th>Город</th>
                <th>Тип</th>
                <th>Дата</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredMugs.map((mug) => (
                <tr key={mug.id}>
                  <td>
                    <div className="table-title">{mug.title}</div>
                    <div className="table-subtitle">{mug.slug}</div>
                  </td>
                  <td>{mug.country?.name_ru || mug.country?.name_en || "—"}</td>
                  <td>{mug.city || "—"}</td>
                  <td>{mug.mug_type || "—"}</td>
                  <td>{mug.received_at || "—"}</td>
                  <td>
                    <span
                      className={
                        mug.is_published
                          ? "status-badge status-badge-light"
                          : "status-badge status-badge-gray"
                      }
                    >
                      {mug.is_published ? "published" : "draft"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="secondary-button"
                        onClick={() => openEditForm(mug)}
                        type="button"
                      >
                        Редактировать
                      </button>
                      <button
                        className="danger-button"
                        onClick={() => deleteMug(mug.id)}
                        type="button"
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredMugs.length === 0 && (
            <div className="empty-inline">Кружки не найдены.</div>
          )}
        </div>
      )}
    </section>
  );
}

export default MugsAdmin;