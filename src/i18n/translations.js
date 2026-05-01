export const translations = {
  ru: {
    map: "Карта",
    catalog: "Каталог",
    countries: "Страны",
    mugs: "Кружки",

    heroTitle: "Интерактивная карта и каталог моей коллекции кружек Starbucks",
    heroText:
      "Исследуйте коллекцию через 3D-карту и каталог с фильтрами. Наведите курсор на страну или кликните по ней — справа появится статус страны и список кружек, если они есть.",

    publishedMugs: "опубликованных кружек",
    countriesWithStarbucks: "стран со Starbucks",
    countriesWithMugs: "стран с кружками",

    legendNoStarbucks: "Starbucks нет",
    legendStarbucksNoMugs: "Starbucks есть, кружек пока нет",
    legendHasMugs: "Есть кружки из страны",

    loadingTitle: "Загрузка данных…",
    loadingText: "Получаем страны и кружки из базы данных.",
    errorTitle: "Ошибка загрузки",
    errorText: "Произошла ошибка при загрузке данных.",
    retry: "Повторить",

    globe3d: "Глобус 3D",

    hoverCountryTitle: "Наведите курсор на страну",
    hoverCountryText: "Здесь будет показываться её статус и кружки.",
    countryNotMatched:
      "Эта страна пока не заведена в базе данных или не сопоставилась с ISO-кодом карты.",

    selectedCountry: "Страна выбрана",
    clearSelection: "Снять выбор",
    hoverHint: "Наведение временное. Кликните по стране, чтобы закрепить её.",

    iso: "ISO",
    starbucks: "Starbucks",
    yes: "есть",
    no: "нет",
    mugsInCollection: "Кружек в коллекции",

    noMugsButStarbucks:
      "В этой стране Starbucks есть, но кружек в вашей коллекции пока нет.",
    noStarbucksNow:
      "В этой стране Starbucks сейчас отмечен как отсутствующий.",

    city: "Город",
    type: "Тип",
    receivedAt: "Когда получена",
    broughtBy: "Кто привёз",
    note: "Заметка",

    catalogTitle: "Каталог кружек",
    catalogSubtitle: "Формат маркетплейса: фильтры слева, карточки кружек справа.",

    totalMugs: "всего кружек",
    filteredMugs: "после фильтрации",
    found: "Найдено: {{count}}",

    filters: "Фильтры",
    search: "Поиск",
    searchPlaceholder: "Название, город, кто привёз, заметка",

    country: "Страна",
    allCountries: "Все страны",

    mugType: "Тип кружки",
    allTypes: "Все типы",

    onlyWithNotes: "Только с заметками",

    sorting: "Сортировка",
    sortNewest: "Сначала новые",
    sortOldest: "Сначала старые",
    sortNameAsc: "По названию А-Я",
    sortNameDesc: "По названию Я-А",

    resetFilters: "Сбросить фильтры",

    noPhotos: "Нет фотографий",
    noNote: "Нет заметки",

    local: "Локальная",
    citySeries: "Городская серия",
    countrySeries: "Страна",
    ornament: "Орнамент",
    relief: "Рельефная",
    icon: "Иконка",
    beenThere: "Been There",
    youAreHere: "You Are Here",
    reserve: "Reserve",
    other: "Другое",

    unknown: "Не указано",

    people: "Люди",
  },

  en: {
    map: "Map",
    catalog: "Catalog",
    countries: "Countries",
    mugs: "Mugs",

    heroTitle: "Interactive map and catalog of my Starbucks mug collection",
    heroText:
      "Explore the collection through a 3D globe and a filterable catalog. Hover over a country or click it — the country status and list of mugs will appear on the right.",

    publishedMugs: "published mugs",
    countriesWithStarbucks: "countries with Starbucks",
    countriesWithMugs: "countries with mugs",

    legendNoStarbucks: "No Starbucks",
    legendStarbucksNoMugs: "Starbucks exists, but no mugs yet",
    legendHasMugs: "Mugs from this country exist",

    loadingTitle: "Loading data…",
    loadingText: "Fetching countries and mugs from the database.",
    errorTitle: "Loading error",
    errorText: "An error occurred while loading data.",
    retry: "Retry",

    globe3d: "3D Globe",

    hoverCountryTitle: "Hover over a country",
    hoverCountryText: "Its status and mugs will be shown here.",
    countryNotMatched:
      "This country has not been added to the database yet or was not matched with the map ISO code.",

    selectedCountry: "Country selected",
    clearSelection: "Clear selection",
    hoverHint: "Hover is temporary. Click a country to pin it.",

    iso: "ISO",
    starbucks: "Starbucks",
    yes: "yes",
    no: "no",
    mugsInCollection: "Mugs in collection",

    noMugsButStarbucks:
      "Starbucks exists in this country, but there are no mugs from it in your collection yet.",
    noStarbucksNow:
      "Starbucks is currently marked as unavailable in this country.",

    city: "City",
    type: "Type",
    receivedAt: "Received",
    broughtBy: "Brought by",
    note: "Note",

    catalogTitle: "Mug Catalog",
    catalogSubtitle: "Marketplace-style layout: filters on the left, mug cards on the right.",

    totalMugs: "total mugs",
    filteredMugs: "after filtering",
    found: "Found: {{count}}",

    filters: "Filters",
    search: "Search",
    searchPlaceholder: "Title, city, who brought it, note",

    country: "Country",
    allCountries: "All countries",

    mugType: "Mug type",
    allTypes: "All types",

    onlyWithNotes: "Only with notes",

    sorting: "Sorting",
    sortNewest: "Newest first",
    sortOldest: "Oldest first",
    sortNameAsc: "Name A-Z",
    sortNameDesc: "Name Z-A",

    resetFilters: "Reset filters",

    noPhotos: "No photos",
    noNote: "No note",

    local: "Local",
    citySeries: "City series",
    countrySeries: "Country",
    ornament: "Ornament",
    relief: "Relief",
    icon: "Icon",
    beenThere: "Been There",
    youAreHere: "You Are Here",
    reserve: "Reserve",
    other: "Other",

    unknown: "Not specified",

    people: "People",
  },
};

export const t = (lang, key, vars = {}) => {
  const locale = translations[lang] || translations.ru;
  let value = locale[key] ?? translations.ru[key] ?? key;

  Object.entries(vars).forEach(([varKey, varValue]) => {
    value = value.replaceAll(`{{${varKey}}}`, String(varValue));
  });

  return value;
};