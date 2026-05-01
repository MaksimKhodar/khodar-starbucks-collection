import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

function PersonSelect({ value = [], onChange, onAddNew }) {
  const rootRef = useRef(null);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draftValues, setDraftValues] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPerson, setNewPerson] = useState({
    first_name: "",
    last_name: "",
  });

  const selectedValues = useMemo(() => {
    return Array.isArray(value) ? value : value ? [value] : [];
  }, [value]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      setLoading(true);

      const { data } = await supabase
        .from("people")
        .select("id, first_name, last_name")
        .order("first_name", { ascending: true });

      if (!active) return;

      setPeople(data ?? []);
      setLoading(false);
    }

    bootstrap();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleClickOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
        setShowCreateForm(false);
        setSearch("");
        setDraftValues(selectedValues);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, selectedValues]);

  const selectedPeople = useMemo(() => {
    return selectedValues
      .map((personId) => people.find((person) => person.id === personId))
      .filter(Boolean);
  }, [people, selectedValues]);

  const filteredPeople = useMemo(() => {
    const query = search.trim().toLowerCase();

    return people.filter((person) => {
      if (!query) return true;

      return `${person.first_name} ${person.last_name}`
        .toLowerCase()
        .includes(query);
    });
  }, [people, search]);

  function openMenu() {
    setDraftValues(selectedValues);
    setSearch("");
    setShowCreateForm(false);
    setIsOpen(true);
  }

  function toggleDraftValue(personId) {
    setDraftValues((prev) =>
      prev.includes(personId)
        ? prev.filter((valueItem) => valueItem !== personId)
        : [...prev, personId]
    );
  }

  function handleConfirm() {
    const selectedItems = people.filter((person) =>
      draftValues.includes(person.id)
    );

    onChange?.(draftValues, selectedItems);
    setIsOpen(false);
    setShowCreateForm(false);
    setSearch("");
  }

  function handleCancel() {
    setDraftValues(selectedValues);
    setIsOpen(false);
    setShowCreateForm(false);
    setSearch("");
    setNewPerson({ first_name: "", last_name: "" });
  }

  async function createNewPerson() {
    if (!newPerson.first_name.trim() || !newPerson.last_name.trim()) {
      alert("Введите имя и фамилию");
      return;
    }

    setCreating(true);

    try {
      const { data, error } = await supabase
        .from("people")
        .insert({
          first_name: newPerson.first_name.trim(),
          last_name: newPerson.last_name.trim(),
          bio: "",
          is_visible: true,
        })
        .select()
        .single();

      if (error) throw error;

      setPeople((prev) => {
        const next = [...prev, data];
        return next.sort((a, b) =>
          `${a.first_name} ${a.last_name}`.localeCompare(
            `${b.first_name} ${b.last_name}`,
            "ru"
          )
        );
      });
      setDraftValues((prev) => (prev.includes(data.id) ? prev : [...prev, data.id]));
      setNewPerson({ first_name: "", last_name: "" });
      setShowCreateForm(false);
      onAddNew?.(data);
    } catch (err) {
      alert("Ошибка при создании человека: " + err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={openMenu}
        disabled={loading}
        style={{
          width: "100%",
          minHeight: "44px",
          borderRadius: "10px",
          border: "1px solid #d5ddd7",
          background: "#ffffff",
          padding: "8px 12px",
          display: "flex",
          justifyContent: "space-between",
          gap: "10px",
          alignItems: "center",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        <span
          style={{
            display: "flex",
            gap: "6px",
            flexWrap: "wrap",
            alignItems: "center",
            textAlign: "left",
            color: selectedPeople.length ? "#111827" : "#6b7280",
          }}
        >
          {selectedPeople.length > 0 ? (
            selectedPeople.map((person) => (
              <span
                key={person.id}
                style={{
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: "#eef6f1",
                  color: "#15563f",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                {person.first_name} {person.last_name}
              </span>
            ))
          ) : (
            <span>{loading ? "Загрузка людей..." : "Выберите людей"}</span>
          )}
        </span>

        <span style={{ color: "#6b7280", fontSize: "14px", flexShrink: 0 }}>
          ▾
        </span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            zIndex: 60,
            borderRadius: "16px",
            border: "1px solid #dbe4dc",
            background: "#ffffff",
            boxShadow: "0 18px 38px rgba(15, 23, 42, 0.12)",
            padding: "14px",
            display: "grid",
            gap: "12px",
          }}
        >
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по людям"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid #d5ddd7",
            }}
          />

          <div
            style={{
              maxHeight: "220px",
              overflowY: "auto",
              display: "grid",
              gap: "8px",
            }}
          >
            {filteredPeople.map((person) => (
              <label
                key={person.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 10px",
                  borderRadius: "10px",
                  background: draftValues.includes(person.id)
                    ? "#f0f8f5"
                    : "#f9fafb",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={draftValues.includes(person.id)}
                  onChange={() => toggleDraftValue(person.id)}
                />
                <span style={{ color: "#111827" }}>
                  {person.first_name} {person.last_name}
                </span>
              </label>
            ))}

            {!loading && filteredPeople.length === 0 && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "10px",
                  background: "#f9fafb",
                  color: "#6b7280",
                  fontSize: "14px",
                }}
              >
                Ничего не найдено.
              </div>
            )}
          </div>

          {showCreateForm ? (
            <div
              style={{
                display: "grid",
                gap: "8px",
                padding: "12px",
                borderRadius: "12px",
                background: "#f9f7f3",
                border: "1px solid #e2e8e3",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                }}
              >
                <input
                  type="text"
                  placeholder="Имя"
                  value={newPerson.first_name}
                  onChange={(event) =>
                    setNewPerson((prev) => ({
                      ...prev,
                      first_name: event.target.value,
                    }))
                  }
                  style={{
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid #d5ddd7",
                  }}
                />
                <input
                  type="text"
                  placeholder="Фамилия"
                  value={newPerson.last_name}
                  onChange={(event) =>
                    setNewPerson((prev) => ({
                      ...prev,
                      last_name: event.target.value,
                    }))
                  }
                  style={{
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid #d5ddd7",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="primary-button"
                  onClick={createNewPerson}
                  disabled={creating}
                >
                  {creating ? "Создаём..." : "Добавить"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewPerson({ first_name: "", last_name: "" });
                  }}
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowCreateForm(true)}
            >
              + Добавить человека
            </button>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={handleCancel}
            >
              Отмена
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={handleConfirm}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PersonSelect;
