export default function MugTable({
  loading,
  error,
  isFormOpen,
  saving,
  search,
  onSearch,
  numberFilter,
  onNumberFilter,
  countryFilter,
  onCountryFilter,
  cityFilter,
  onCityFilter,
  sortBy,
  onSortBy,
  filtersOpen,
  onToggleFilters,
  activeFilters,
  countryFilterOptions,
  cityFilterOptions,
  filteredMugs,
  onEdit,
  onDelete,
  onRefresh,
  onCreate,
}) {
  return (
    <>
      {/* ── Toolbar ── */}
      <div className="admin-toolbar">
        <div>
          <div className="section-title">Администрирование кружек</div>
          <p className="admin-subtitle">
            Здесь можно добавлять, редактировать и удалять кружки, управлять цветами, типами и городами.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 240px" }}>
            <span style={{
              position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
              color: "#8a9e96", pointerEvents: "none",
            }}>🔍</span>
            <input
              className="admin-search"
              type="text"
              placeholder="Поиск по названию, стране, городу, цвету..."
              value={search}
              onChange={e => onSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>

          <input
            className="admin-search"
            type="number"
            min="1"
            placeholder="№ кружки"
            value={numberFilter}
            onChange={e => onNumberFilter(e.target.value.replace(/[^\d]/g, ""))}
            style={{ width: 100, flex: "0 0 auto" }}
            title="Точный поиск по номеру коллекции"
          />

          <button
            type="button"
            onClick={onToggleFilters}
            className="secondary-button"
            style={{
              background: filtersOpen ? "#153126" : undefined,
              color: filtersOpen ? "#fff" : undefined,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            ⚙ Фильтры
            {activeFilters > 0 && (
              <span style={{
                background: "#1f6f54", color: "#fff",
                borderRadius: 999, padding: "1px 7px", fontSize: 11, fontWeight: 700,
              }}>{activeFilters}</span>
            )}
          </button>

          <select
            className="admin-search"
            value={sortBy}
            onChange={e => onSortBy(e.target.value)}
            style={{ flex: "0 0 auto" }}
          >
            <option value="collection-desc">№: новые сверху</option>
            <option value="collection-asc">№: старые сверху</option>
            <option value="country-asc">Страна А→Я</option>
            <option value="created-desc">Недавно добавленные</option>
            <option value="updated-desc">Недавно изменённые</option>
          </select>

          <button className="secondary-button" onClick={onRefresh} type="button" disabled={saving}>
            Обновить
          </button>
          <button className="primary-button" onClick={onCreate} type="button" disabled={isFormOpen}>
            + Добавить кружку
          </button>
        </div>

        {filtersOpen && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12, padding: 16,
            background: "#f8f4ed", borderRadius: 16,
            border: "1px solid #eadfce", marginTop: 4,
          }}>
            <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "#31443a" }}>
              Страна
              <select className="admin-search" value={countryFilter} onChange={e => { onCountryFilter(e.target.value); onCityFilter(""); }}>
                <option value="">Все страны</option>
                {countryFilterOptions.map(o => <option key={o.value} value={o.value}>{o.displayLabel}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "#31443a" }}>
              Город
              <select className="admin-search" value={cityFilter} onChange={e => onCityFilter(e.target.value)}>
                <option value="">Все города</option>
                {cityFilterOptions.map(o => <option key={o.value} value={o.value}>{o.displayLabel}</option>)}
              </select>
            </label>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                type="button" className="secondary-button"
                onClick={() => { onCountryFilter(""); onCityFilter(""); onNumberFilter(""); onSearch(""); }}
              >
                Сбросить все
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="empty-state"><h2>Загрузка…</h2></div>
      ) : error && !isFormOpen ? (
        <div className="empty-state"><h2>Ошибка</h2><p>{error}</p></div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Название</th>
                <th>Страна</th>
                <th>Штат</th>
                <th>Город</th>
                <th>Тип</th>
                <th>Цвета</th>
                <th>Дата получения</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredMugs.map(mug => (
                <tr key={mug.id}>
                  <td><strong>{mug.collection_number || "—"}</strong></td>
                  <td>
                    <div className="table-title">{mug.title}</div>
                    {mug.brought_by && <div className="table-subtitle">{mug.brought_by}</div>}
                  </td>
                  <td>{mug.countryLabel || "—"}</td>
                  <td>{mug.stateLabel || "—"}</td>
                  <td>{mug.cityLabel || "—"}</td>
                  <td>{mug.typeLabels.join(", ") || "—"}</td>
                  <td>{mug.colorLabels.join(", ") || "—"}</td>
                  <td>{mug.received_at || "—"}</td>
                  <td>
                    <span className={mug.is_published ? "status-badge status-badge-light" : "status-badge status-badge-gray"}>
                      {mug.is_published ? "published" : "draft"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="secondary-button"
                        onClick={() => onEdit(mug)}
                        type="button" disabled={saving}
                      >Редактировать</button>
                      <button
                        className="danger-button"
                        onClick={() => onDelete(mug.id)}
                        type="button" disabled={saving}
                      >Удалить</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMugs.length === 0 && (
            <div className="empty-inline">Ничего не найдено.</div>
          )}
        </div>
      )}
    </>
  );
}
