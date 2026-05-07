export default function CityCreator({ isOpen, newCityName, onChange, isCreating, error, onCreate, onCancel }) {
  if (!isOpen) return null;
  return (
    <div style={{
      gridColumn: "1 / -1",
      padding: "12px 14px", borderRadius: 12,
      background: "#f9f7f3", border: "1px solid #e2e8e3",
      display: "grid", gap: 8,
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#31443a" }}>Новый город</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="text"
          value={newCityName}
          onChange={e => onChange(e.target.value)}
          placeholder="Название города"
          style={{ flex: 1 }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onCreate(); } }}
        />
        <button type="button" className="primary-button" onClick={onCreate} disabled={isCreating}>
          {isCreating ? "Создаём…" : "Создать"}
        </button>
        <button type="button" className="secondary-button" onClick={onCancel} disabled={isCreating}>
          Отмена
        </button>
      </div>
      {error && <span style={{ color: "#b91c1c", fontSize: 12 }}>{error}</span>}
    </div>
  );
}
