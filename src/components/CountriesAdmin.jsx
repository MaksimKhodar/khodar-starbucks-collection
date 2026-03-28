import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

function CountriesAdmin({ onChanged }) {
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [savingKey, setSavingKey] = useState("");

  useEffect(() => {
    loadCountries();
  }, []);

  async function loadCountries() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("countries")
      .select(
        "id, iso2_code, name_en, name_ru, has_starbucks_current, is_visible, updated_at"
      )
      .order("name_en", { ascending: true });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setCountries(data ?? []);
    setLoading(false);
  }

  async function toggleField(countryId, field, value) {
  const key = `${countryId}-${field}`;
  const previousCountries = countries;

  setSavingKey(key);
  setError("");

  // optimistic update
  setCountries((prev) =>
    prev.map((country) =>
      country.id === countryId ? { ...country, [field]: value } : country
    )
  );

  try {
    const { error } = await supabase
      .from("countries")
      .update({ [field]: value })
      .eq("id", countryId);

    if (error) {
      throw error;
    }

    await onChanged?.();
  } catch (err) {
    setCountries(previousCountries);
    setError(err.message || "Не удалось сохранить изменение.");
  } finally {
    setSavingKey("");
  }
}

  const filteredCountries = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return countries;

    return countries.filter((country) => {
      return (
        country.name_en.toLowerCase().includes(q) ||
        (country.name_ru ?? "").toLowerCase().includes(q) ||
        country.iso2_code.toLowerCase().includes(q)
      );
    });
  }, [countries, search]);

  return (
    <section className="card admin-card">
      <div className="admin-toolbar">
        <div>
          <div className="section-title">Администрирование стран</div>
          <p className="admin-subtitle">
            Здесь можно вручную отмечать, есть ли Starbucks в стране, и скрывать
            страну из публичной карты.
          </p>
        </div>

        <div className="admin-actions">
          <input
            className="admin-search"
            type="text"
            placeholder="Поиск по стране или ISO-коду"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="secondary-button" onClick={loadCountries}>
            Обновить
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <h2>Загрузка стран…</h2>
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
                <th>ISO2</th>
                <th>Название</th>
                <th>Название RU</th>
                <th>Starbucks</th>
                <th>Показывать на карте</th>
              </tr>
            </thead>
            <tbody>
              {filteredCountries.map((country) => {
                const savingStarbucks =
                  savingKey === `${country.id}-has_starbucks_current`;
                const savingVisible = savingKey === `${country.id}-is_visible`;

                return (
                  <tr key={country.id}>
                    <td>{country.iso2_code}</td>
                    <td>{country.name_en}</td>
                    <td>{country.name_ru || "—"}</td>

                    <td>
                      <label className="checkbox-cell">
                        <input
                          type="checkbox"
                          checked={country.has_starbucks_current}
                          disabled={savingStarbucks}
                          onChange={(e) =>
                            toggleField(
                              country.id,
                              "has_starbucks_current",
                              e.target.checked
                            )
                          }
                        />
                        <span>
                          {country.has_starbucks_current ? "есть" : "нет"}
                        </span>
                      </label>
                    </td>

                    <td>
                      <label className="checkbox-cell">
                        <input
                          type="checkbox"
                          checked={country.is_visible}
                          disabled={savingVisible}
                          onChange={(e) =>
                            toggleField(country.id, "is_visible", e.target.checked)
                          }
                        />
                        <span>{country.is_visible ? "да" : "нет"}</span>
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredCountries.length === 0 && (
            <div className="empty-inline">Ничего не найдено.</div>
          )}
        </div>
      )}
    </section>
  );
}

export default CountriesAdmin;