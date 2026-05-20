import { useEffect } from "react";
import MugImagesManager from "./MugImagesManager";
import PersonSelect from "./PersonSelect";
import ConfirmModal from "./ConfirmModal";
import TypeSelect from "./TypeSelect";
import CityCreator from "./CityCreator";
import { COLOR_OPTIONS, getLocalizedOptionLabel } from "../data/mugMetadata";

// ── Color swatches ─────────────────────────────────────────────────────────

const COLOR_SWATCHES = {
  green: "#4CAF50", blue: "#2196F3", red: "#F44336", yellow: "#FFC107",
  orange: "#FF9800", brown: "#795548", black: "#212121", white: "#F5F5F5",
  gray: "#9E9E9E", grey: "#9E9E9E", purple: "#9C27B0", pink: "#E91E63",
  gold: "#FFD700", silver: "#C0C0C0", beige: "#D4B896", turquoise: "#00BCD4",
  multicolor: "#ccc", navy: "#1a237e",
};

// ── Drawer ─────────────────────────────────────────────────────────────────

function Drawer({ isOpen, onClose, title, children }) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.35)",
          zIndex: 600, backdropFilter: "blur(2px)",
        }}
      />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(640px, 100vw)",
        background: "#fff", zIndex: 601,
        display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 40px rgba(0,0,0,0.15)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 24px", borderBottom: "1px solid #e8e2d9", flexShrink: 0,
        }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: "#153126" }}>{title}</span>
          <button
            type="button" onClick={onClose}
            style={{
              background: "none", border: "none", fontSize: 22,
              color: "#9ca3af", cursor: "pointer", padding: "4px 8px", lineHeight: 1,
            }}
          >✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 40px" }}>
          {children}
        </div>
      </div>
    </>
  );
}

// ── SectionDivider ─────────────────────────────────────────────────────────

function SectionDivider({ title }) {
  return (
    <div style={{
      gridColumn: "1 / -1",
      display: "flex", alignItems: "center", gap: 10,
      margin: "12px 0 0",
    }}>
      <span style={{
        fontSize: 11, fontWeight: 800, color: "#1f6f54",
        textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap",
      }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: "#e2ddd4" }} />
    </div>
  );
}

// ── ColorChips ─────────────────────────────────────────────────────────────

function ColorChips({ options = [], values = [], onToggle, language = "ru" }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map(option => {
        const active = values.includes(option.key);
        const swatch = COLOR_SWATCHES[option.key];
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onToggle(option.key)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "7px 13px", borderRadius: 999,
              border: active ? "2px solid #1f6f54" : "1.5px solid #d1d5db",
              background: active ? "#ecf7f1" : "#fff",
              color: active ? "#15563f" : "#374151",
              cursor: "pointer", fontSize: 13, fontWeight: 600,
              transition: "all 0.15s",
            }}
          >
            {swatch && (
              <span style={{
                width: 13, height: 13, borderRadius: "50%", flexShrink: 0,
                background: swatch,
                border: option.key === "white" ? "1px solid #ccc" : "none",
              }} />
            )}
            {getLocalizedOptionLabel(option, language)}
          </button>
        );
      })}
    </div>
  );
}

// ── MugForm ────────────────────────────────────────────────────────────────

export default function MugForm({
  isOpen,
  onClose,
  form,
  error,
  saving,
  language,
  nextCollectionNumber,
  pendingImageFiles,
  onPendingFilesChange,
  countryDisplayOptions,
  currentStateOptions,
  currentCityOptions,
  currentCountryHasStates,
  hasDbCities,
  statesError,
  citiesError,
  typeOptions,
  isCityCreatorOpen,
  onOpenCityCreator,
  newCityName,
  onNewCityNameChange,
  isCreatingCity,
  cityCreateError,
  onCreateCity,
  onCancelCityCreator,
  isDiscardModalOpen,
  onCancelDiscard,
  onConfirmDiscard,
  onSubmit,
  onUpdateForm,
  onUpdateCollectionNumber,
  onUpdateCountry,
  onUpdateState,
  onUpdateCity,
  onToggleMultiValue,
  onImageChanged,
}) {
  const drawerTitle = form.id
    ? `Редактировать кружку #${form.collection_number}`
    : "Новая кружка";

  return (
    <>
      <Drawer isOpen={isOpen} onClose={onClose} title={drawerTitle}>
        <form onSubmit={onSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

            {/* ── Основное ── */}
            <SectionDivider title="Основное" />

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#31443a" }}>
                  Название <span style={{ color: "#dc2626" }}>*</span>
                </span>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => onUpdateForm("title", e.target.value)}
                  placeholder="Например: Starbucks Warsaw"
                />
              </label>
            </div>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#31443a" }}>Дата получения</span>
              <input
                type="date"
                value={form.received_at}
                onChange={e => onUpdateForm("received_at", e.target.value)}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#31443a" }}>
                № в коллекции <span style={{ color: "#dc2626" }}>*</span>
              </span>
              <input
                type="number" min="1" step="1"
                value={form.collection_number}
                onChange={e => onUpdateCollectionNumber(e.target.value)}
                placeholder={`Например: ${nextCollectionNumber}`}
              />
              <span style={{ fontSize: 11, color: "#8a9e96" }}>
                Порядковый номер, совпадает с нумерацией в Instagram
              </span>
            </label>

            {/* ── Кто привёз ── */}
            <SectionDivider title="Кто привёз" />

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#31443a" }}>
                  Выбрать из справочника
                </span>
                <PersonSelect
                  value={form.brought_by_person_ids}
                  onChange={(personIds, persons) => {
                    onUpdateForm("brought_by_person_ids", personIds || []);
                    if (Array.isArray(persons) && persons.length > 0) {
                      onUpdateForm("brought_by", persons.map(p => `${p.first_name} ${p.last_name}`).join(", "));
                    }
                  }}
                />
              </label>
            </div>


            {/* ── География ── */}
            <SectionDivider title="География" />

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#31443a" }}>
                  Страна <span style={{ color: "#dc2626" }}>*</span>
                </span>
                <select value={form.country_id} onChange={e => onUpdateCountry(e.target.value)}>
                  <option value="">Выберите страну</option>
                  {countryDisplayOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {currentCountryHasStates && (
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#31443a" }}>Штат / регион</span>
                <select value={form.state_id} onChange={e => onUpdateState(e.target.value)}>
                  <option value="">Не выбран</option>
                  {currentStateOptions.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                {statesError && (
                  <span style={{ fontSize: 11, color: "#dc2626" }}>{statesError}</span>
                )}
              </label>
            )}

            <label style={{
              display: "grid", gap: 6,
              gridColumn: currentCountryHasStates ? "auto" : "1 / -1",
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#31443a" }}>Город</span>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value={form.city_key}
                  onChange={e => onUpdateCity(e.target.value)}
                  disabled={!form.country_id || (currentCountryHasStates && !form.state_id)}
                  style={{ flex: 1 }}
                >
                  <option value="">
                    {!form.country_id
                      ? "Сначала выберите страну"
                      : currentCountryHasStates && !form.state_id
                        ? "Сначала выберите штат"
                        : "Не выбран"}
                  </option>
                  {(() => {
                    const popular = currentCityOptions.filter(c => c._mugCount > 0).slice(0, 5);
                    const rest = currentCityOptions.filter(c => !popular.includes(c));
                    if (popular.length === 0) {
                      return currentCityOptions.map(c => (
                        <option key={c.key} value={c.key}>
                          {getLocalizedOptionLabel(c, language)}
                        </option>
                      ));
                    }
                    return (
                      <>
                        <optgroup label="⭐ Популярные">
                          {popular.map(c => (
                            <option key={c.key} value={c.key}>
                              {getLocalizedOptionLabel(c, language)}
                            </option>
                          ))}
                        </optgroup>
                        {rest.length > 0 && (
                          <optgroup label="Все города">
                            {rest.map(c => (
                              <option key={c.key} value={c.key}>
                                {getLocalizedOptionLabel(c, language)}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    );
                  })()}
                </select>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!form.country_id || isCreatingCity || (currentCountryHasStates && !form.state_id)}
                  onClick={onOpenCityCreator}
                  style={{ minWidth: 36, padding: "0 10px" }}
                  title="Добавить город"
                >+</button>
              </div>
              {citiesError && <span style={{ fontSize: 11, color: "#dc2626" }}>{citiesError}</span>}
              {!hasDbCities && form.country_id && !(currentCountryHasStates && !form.state_id) && (
                <span style={{ fontSize: 11, color: "#8a9e96" }}>
                  Городов пока нет. Нажмите + чтобы добавить.
                </span>
              )}
            </label>

            <CityCreator
              isOpen={isCityCreatorOpen}
              newCityName={newCityName}
              onChange={onNewCityNameChange}
              isCreating={isCreatingCity}
              error={cityCreateError}
              onCreate={onCreateCity}
              onCancel={onCancelCityCreator}
            />

            {/* ── Характеристики ── */}
            <SectionDivider title="Характеристики" />

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#31443a" }}>Тип / коллекция</span>
                <TypeSelect
                  value={form.type_values}
                  options={typeOptions}
                  onChange={vals => onUpdateForm("type_values", vals || [])}
                />
              </label>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#31443a", display: "block", marginBottom: 10 }}>
                Цвета
              </span>
              <ColorChips
                options={COLOR_OPTIONS}
                values={form.color_keys}
                onToggle={key => onToggleMultiValue("color_keys", key)}
                language={language}
              />
            </div>

            {/* ── История и публикация ── */}
            <SectionDivider title="История и публикация" />

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#31443a" }}>История / заметка</span>
                <textarea
                  rows="4"
                  value={form.note}
                  onChange={e => onUpdateForm("note", e.target.value)}
                  placeholder="Откуда кружка, интересная история, особенности..."
                />
              </label>
            </div>

            <label style={{
              display: "flex", alignItems: "center", gap: 10,
              cursor: "pointer", gridColumn: "1 / -1",
            }}>
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={e => onUpdateForm("is_published", e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontSize: 14, color: "#1f2937" }}>
                Опубликовано (видно на сайте)
              </span>
            </label>

          </div>

          {/* Images */}
          <div style={{ marginTop: 20 }}>
            <MugImagesManager
              mugId={form.id}
              pendingFiles={pendingImageFiles}
              onPendingFilesChange={onPendingFilesChange}
              onChanged={onImageChanged}
              language={language}
            />
          </div>

          {error && (
            <div style={{
              marginTop: 16, padding: "12px 14px", borderRadius: 12,
              background: "#fef2f2", border: "1px solid #fecaca",
              color: "#b91c1c", fontSize: 14,
            }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
            <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Сохраняем…" : form.id ? "Сохранить" : "Создать кружку"}
            </button>
          </div>
        </form>
      </Drawer>

      <ConfirmModal
        isOpen={isDiscardModalOpen}
        title="Закрыть без сохранения?"
        message="Вы внесли изменения. Они будут потеряны если закрыть форму сейчас."
        confirmLabel="Закрыть без сохранения"
        cancelLabel="Продолжить редактирование"
        danger
        onCancel={onCancelDiscard}
        onConfirm={onConfirmDiscard}
      />
    </>
  );
}
