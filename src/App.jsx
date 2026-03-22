import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import mugs from "./data/mugs.json";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

function App() {
  const [activeCountry, setActiveCountry] = useState("");

  const mugsByCountry = useMemo(() => {
    return mugs.reduce((acc, mug) => {
      if (!acc[mug.countryName]) {
        acc[mug.countryName] = [];
      }
      acc[mug.countryName].push(mug);
      return acc;
    }, {});
  }, []);

  const countriesWithMugs = useMemo(() => {
    return new Set(Object.keys(mugsByCountry));
  }, [mugsByCountry]);

  const activeMugs = activeCountry ? mugsByCountry[activeCountry] ?? [] : [];

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Khodar Starbucks Collection</p>
        <h1>Интерактивная карта моей коллекции кружек Starbucks</h1>
        <p className="hero-text">
          Наведите курсор на страну на карте. Справа появится список кружек,
          связанных с этой страной.
        </p>

        <div className="stats">
          <div className="stat">
            <span className="stat-value">{mugs.length}</span>
            <span className="stat-label">кружек</span>
          </div>
          <div className="stat">
            <span className="stat-value">{countriesWithMugs.size}</span>
            <span className="stat-label">стран</span>
          </div>
        </div>
      </header>

      <main className="layout">
        <section className="card map-card">
          <div className="section-title">Карта мира</div>

          <ComposableMap className="map" projectionConfig={{ scale: 145 }}>
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const countryName = geo.properties.name;
                  const hasMugs = countriesWithMugs.has(countryName);
                  const isActive = activeCountry === countryName;

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={() => setActiveCountry(countryName)}
                      style={{
                        default: {
                          fill: isActive
                            ? "#0d6f48"
                            : hasMugs
                            ? "#2ea66d"
                            : "#d7e2da",
                          stroke: "#ffffff",
                          strokeWidth: 0.6,
                          outline: "none",
                        },
                        hover: {
                          fill: hasMugs ? "#145c3c" : "#bcc9bf",
                          stroke: "#ffffff",
                          strokeWidth: 0.6,
                          outline: "none",
                          cursor: "pointer",
                        },
                        pressed: {
                          fill: "#145c3c",
                          stroke: "#ffffff",
                          strokeWidth: 0.6,
                          outline: "none",
                        },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>
        </section>

        <aside className="card side-card">
          {!activeCountry ? (
            <div className="empty-state">
              <h2>Наведите курсор на страну</h2>
              <p>
                Пока здесь будет показываться список кружек из выбранной страны.
              </p>
            </div>
          ) : (
            <>
              <div className="section-title">{activeCountry}</div>

              {activeMugs.length === 0 ? (
                <div className="empty-state">
                  <p>Для этой страны пока нет кружек в коллекции.</p>
                </div>
              ) : (
                <div className="mug-list">
                  {activeMugs.map((mug) => (
                    <article className="mug-card" key={mug.id}>
                      {mug.image ? (
                        <img
                          className="mug-image"
                          src={mug.image}
                          alt={mug.title}
                        />
                      ) : (
                        <div className="photo-placeholder">Фото будет здесь</div>
                      )}

                      <div className="mug-content">
                        <h3>{mug.title}</h3>
                        <p>
                          <strong>Город:</strong> {mug.city}
                        </p>
                        <p>
                          <strong>Тип:</strong> {mug.type}
                        </p>
                        <p>
                          <strong>Когда получена:</strong> {mug.receivedAt}
                        </p>
                        <p>
                          <strong>Кто привёз:</strong> {mug.broughtBy}
                        </p>
                        <p>
                          <strong>Заметка:</strong> {mug.note}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </aside>
      </main>
    </div>
  );
}

export default App;