import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import PeopleGrid from "./PeopleGrid";
import { useLanguage } from "../context/LanguageContext";

function PeopleVisualization({ mugs = [], countries = [] }) {
  const { language } = useLanguage();
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadPeople() {
    setLoading(true);
    setError("");

    const { data, error: err } = await supabase
      .from("people")
      .select("id, first_name, last_name, bio, avatar_image_path, instagram_url, is_visible")
      .eq("is_visible", true)
      .order("first_name", { ascending: true });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setPeople(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPeople();
  }, []);

  const t = {
    ru: {
      title: "Люди в моей коллекции",
      subtitle:
        "Встречайте людей, которые помогли мне собрать эту коллекцию кружек от Starbucks со всего мира",
      loading: "Загрузка...",
      error: "Ошибка загрузки",
      noData: "Данные о людях ещё не добавлены",
    },
    en: {
      title: "People in my collection",
      subtitle:
        "Meet the people who helped me build this Starbucks mug collection from around the world",
      loading: "Loading...",
      error: "Error loading",
      noData: "No people added yet",
    },
  };

  const tr = t[language] || t.ru;

  return (
    <main className="layout">
      <section className="card map-card">
        <div style={{ marginBottom: "20px" }}>
          <h1 style={{ margin: "0 0 8px 0", fontSize: "28px" }}>
            {tr.title}
          </h1>
          <p style={{ margin: 0, color: "#666", fontSize: "15px" }}>
            {tr.subtitle}
          </p>
        </div>

        {loading ? (
          <div className="empty-state">
            <h2>{tr.loading}</h2>
          </div>
        ) : error ? (
          <div className="empty-state">
            <h2>{tr.error}</h2>
            <p>{error}</p>
          </div>
        ) : people.length === 0 ? (
          <div className="empty-state">
            <h2>{tr.noData}</h2>
          </div>
        ) : (
          <PeopleGrid
            people={people}
            mugs={mugs}
            countries={countries}
            language={language}
            onPersonUpdated={loadPeople}
          />
        )}
      </section>
    </main>
  );
}

export default PeopleVisualization;
