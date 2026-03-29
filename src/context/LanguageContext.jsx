import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translations } from "../i18n/translations";

const LanguageContext = createContext(null);
const STORAGE_KEY = "khodar-collection-language";

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_KEY)
        : null;

    return saved === "en" ? "en" : "ru";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => {
    function t(key) {
      return (
        translations[language]?.[key] ||
        translations.ru?.[key] ||
        key
      );
    }

    return {
      language,
      setLanguage,
      t,
    };
  }, [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }

  return context;
}