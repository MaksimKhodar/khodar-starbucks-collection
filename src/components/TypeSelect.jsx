import { useEffect, useMemo, useRef, useState } from "react";

function TypeSelect({
  value = [],
  options = [],
  onChange,
  disabled = false,
}) {
  const rootRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draftValues, setDraftValues] = useState([]);
  const [customOptions, setCustomOptions] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newTypeLabel, setNewTypeLabel] = useState("");

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleClickOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsAdding(false);
        setSearch("");
        setDraftValues(Array.isArray(value) ? value : []);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, value]);

  const selectedValues = useMemo(() => {
    return Array.isArray(value) ? value : [];
  }, [value]);

  const mergedOptions = useMemo(() => {
    const nextMap = new Map();

    [...options, ...customOptions].forEach((option) => {
      if (option?.value) {
        nextMap.set(option.value, option);
      }
    });

    return [...nextMap.values()];
  }, [options, customOptions]);

  const selectedOptions = useMemo(() => {
    return selectedValues
      .map((itemValue) => {
        return (
          mergedOptions.find((option) => option.value === itemValue) || {
            value: itemValue,
            label: itemValue,
          }
        );
      })
      .filter(Boolean);
  }, [mergedOptions, selectedValues]);

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return mergedOptions.filter((option) => {
      if (!query) return true;
      return option.label.toLowerCase().includes(query);
    });
  }, [mergedOptions, search]);

  function openMenu() {
    if (disabled) return;
    setDraftValues(selectedValues);
    setSearch("");
    setIsAdding(false);
    setNewTypeLabel("");
    setIsOpen(true);
  }

  function toggleDraftValue(optionValue) {
    setDraftValues((prev) =>
      prev.includes(optionValue)
        ? prev.filter((item) => item !== optionValue)
        : [...prev, optionValue]
    );
  }

  function handleConfirm() {
    const nextSelectedOptions = draftValues
      .map((itemValue) => {
        return (
          mergedOptions.find((option) => option.value === itemValue) || {
            value: itemValue,
            label: itemValue,
          }
        );
      })
      .filter(Boolean);

    onChange?.(draftValues, nextSelectedOptions);
    setIsOpen(false);
    setIsAdding(false);
    setSearch("");
  }

  function handleCancel() {
    setDraftValues(selectedValues);
    setIsOpen(false);
    setIsAdding(false);
    setSearch("");
    setNewTypeLabel("");
  }

  function handleAddType() {
    const trimmed = newTypeLabel.trim();
    if (!trimmed) return;

    const existingOption =
      mergedOptions.find(
        (option) => option.label.toLowerCase() === trimmed.toLowerCase()
      ) || null;

    const nextOption = existingOption || {
      value: trimmed,
      label: trimmed,
      isPreset: false,
    };

    if (!existingOption) {
      setCustomOptions((prev) => [...prev, nextOption]);
    }

    setDraftValues((prev) =>
      prev.includes(nextOption.value) ? prev : [...prev, nextOption.value]
    );
    setNewTypeLabel("");
    setIsAdding(false);
    setSearch("");
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={openMenu}
        disabled={disabled}
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
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <span
          style={{
            display: "flex",
            gap: "6px",
            flexWrap: "wrap",
            alignItems: "center",
            textAlign: "left",
            color: selectedOptions.length ? "#111827" : "#6b7280",
          }}
        >
          {selectedOptions.length > 0 ? (
            selectedOptions.map((option) => (
              <span
                key={option.value}
                style={{
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: "#eef6f1",
                  color: "#15563f",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                {option.label}
              </span>
            ))
          ) : (
            <span>Выберите один или несколько типов</span>
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
            placeholder="Поиск по типам"
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
            {filteredOptions.map((option) => (
              <label
                key={option.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 10px",
                  borderRadius: "10px",
                  background: draftValues.includes(option.value)
                    ? "#f0f8f5"
                    : "#f9fafb",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={draftValues.includes(option.value)}
                  onChange={() => toggleDraftValue(option.value)}
                />
                <span style={{ color: "#111827" }}>{option.label}</span>
              </label>
            ))}

            {filteredOptions.length === 0 && (
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

          {isAdding ? (
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
              <input
                type="text"
                value={newTypeLabel}
                onChange={(event) => setNewTypeLabel(event.target.value)}
                placeholder="Введите новый тип"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #d5ddd7",
                }}
              />
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleAddType}
                >
                  Добавить
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setIsAdding(false);
                    setNewTypeLabel("");
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
              onClick={() => {
                setIsAdding(true);
                setNewTypeLabel(search.trim());
              }}
            >
              + Добавить тип
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

export default TypeSelect;
