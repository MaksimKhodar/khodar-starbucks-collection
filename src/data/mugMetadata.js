const COLOR_OPTIONS = [
  { key: "white", label: { ru: "Белый", en: "White" }, swatch: "#f5f1e8" },
  { key: "black", label: { ru: "Чёрный", en: "Black" }, swatch: "#1f2937" },
  { key: "green", label: { ru: "Зелёный", en: "Green" }, swatch: "#1f6f54" },
  { key: "red", label: { ru: "Красный", en: "Red" }, swatch: "#c2413b" },
  { key: "blue", label: { ru: "Синий", en: "Blue" }, swatch: "#2b6cb0" },
  { key: "navy", label: { ru: "Тёмно-синий", en: "Navy" }, swatch: "#1e3a5f" },
  { key: "yellow", label: { ru: "Жёлтый", en: "Yellow" }, swatch: "#eab308" },
  { key: "orange", label: { ru: "Оранжевый", en: "Orange" }, swatch: "#f97316" },
  { key: "pink", label: { ru: "Розовый", en: "Pink" }, swatch: "#ec4899" },
  { key: "purple", label: { ru: "Фиолетовый", en: "Purple" }, swatch: "#7c3aed" },
  { key: "brown", label: { ru: "Коричневый", en: "Brown" }, swatch: "#8b5e3c" },
  { key: "beige", label: { ru: "Бежевый", en: "Beige" }, swatch: "#d6c2a1" },
  { key: "gold", label: { ru: "Золотой", en: "Gold" }, swatch: "#c99700" },
  { key: "silver", label: { ru: "Серебристый", en: "Silver" }, swatch: "#9ca3af" },
  { key: "gray", label: { ru: "Серый", en: "Gray" }, swatch: "#6b7280" },
  { key: "multicolor", label: { ru: "Многоцветный", en: "Multicolor" }, swatch: "linear-gradient(135deg, #ef4444 0%, #eab308 25%, #22c55e 50%, #3b82f6 75%, #a855f7 100%)" },
  { key: "other", label: { ru: "Другое", en: "Other" }, swatch: "#ffffff" },
];

const COLLECTION_OPTIONS = [
  { key: "you-are-here", label: { ru: "You Are Here", en: "You Are Here" }, category: "series" },
  { key: "country-series", label: { ru: "Серия стран", en: "Country Series" }, category: "series" },
  { key: "city-series", label: { ru: "Городская серия", en: "City Series" }, category: "series" },
  { key: "new-year", label: { ru: "Новый год", en: "New Year" }, category: "seasonal" },
  { key: "christmas", label: { ru: "Рождество", en: "Christmas" }, category: "seasonal" },
  { key: "reserve", label: { ru: "Reserve", en: "Reserve" }, category: "series" },
  { key: "disney", label: { ru: "Disney Parks", en: "Disney Parks" }, category: "collab" },
  { key: "anniversary", label: { ru: "Юбилейная", en: "Anniversary" }, category: "special" },
  { key: "winter", label: { ru: "Зимняя", en: "Winter" }, category: "seasonal" },
  { key: "spring", label: { ru: "Весенняя", en: "Spring" }, category: "seasonal" },
  { key: "summer", label: { ru: "Летняя", en: "Summer" }, category: "seasonal" },
  { key: "autumn", label: { ru: "Осенняя", en: "Autumn" }, category: "seasonal" },
  { key: "halloween", label: { ru: "Хэллоуин", en: "Halloween" }, category: "seasonal" },
  { key: "valentines-day", label: { ru: "День святого Валентина", en: "Valentine's Day" }, category: "seasonal" },
];

const WORLD_CITIES = [
  { key: "warsaw-pl", countryIso: "PL", label: { ru: "Варшава", en: "Warsaw" }, lat: 52.2297, lng: 21.0122 },
  { key: "krakow-pl", countryIso: "PL", label: { ru: "Краков", en: "Krakow" }, lat: 50.0647, lng: 19.945 },
  { key: "gdansk-pl", countryIso: "PL", label: { ru: "Гданьск", en: "Gdansk" }, lat: 54.352, lng: 18.6466 },
  { key: "wroclaw-pl", countryIso: "PL", label: { ru: "Вроцлав", en: "Wroclaw" }, lat: 51.1079, lng: 17.0385 },
  { key: "rome-it", countryIso: "IT", label: { ru: "Рим", en: "Rome" }, lat: 41.9028, lng: 12.4964 },
  { key: "milan-it", countryIso: "IT", label: { ru: "Милан", en: "Milan" }, lat: 45.4642, lng: 9.19 },
  { key: "florence-it", countryIso: "IT", label: { ru: "Флоренция", en: "Florence" }, lat: 43.7696, lng: 11.2558 },
  { key: "venice-it", countryIso: "IT", label: { ru: "Венеция", en: "Venice" }, lat: 45.4408, lng: 12.3155 },
  { key: "tokyo-jp", countryIso: "JP", label: { ru: "Токио", en: "Tokyo" }, lat: 35.6762, lng: 139.6503 },
  { key: "osaka-jp", countryIso: "JP", label: { ru: "Осака", en: "Osaka" }, lat: 34.6937, lng: 135.5023 },
  { key: "kyoto-jp", countryIso: "JP", label: { ru: "Киото", en: "Kyoto" }, lat: 35.0116, lng: 135.7681 },
  { key: "sapporo-jp", countryIso: "JP", label: { ru: "Саппоро", en: "Sapporo" }, lat: 43.0618, lng: 141.3545 },
  { key: "new-york-us", countryIso: "US", label: { ru: "Нью-Йорк", en: "New York" }, lat: 40.7128, lng: -74.006 },
  { key: "seattle-us", countryIso: "US", label: { ru: "Сиэтл", en: "Seattle" }, lat: 47.6062, lng: -122.3321 },
  { key: "chicago-us", countryIso: "US", label: { ru: "Чикаго", en: "Chicago" }, lat: 41.8781, lng: -87.6298 },
  { key: "los-angeles-us", countryIso: "US", label: { ru: "Лос-Анджелес", en: "Los Angeles" }, lat: 34.0522, lng: -118.2437 },
  { key: "san-francisco-us", countryIso: "US", label: { ru: "Сан-Франциско", en: "San Francisco" }, lat: 37.7749, lng: -122.4194 },
  { key: "paris-fr", countryIso: "FR", label: { ru: "Париж", en: "Paris" }, lat: 48.8566, lng: 2.3522 },
  { key: "lyon-fr", countryIso: "FR", label: { ru: "Лион", en: "Lyon" }, lat: 45.764, lng: 4.8357 },
  { key: "nice-fr", countryIso: "FR", label: { ru: "Ницца", en: "Nice" }, lat: 43.7102, lng: 7.262 },
  { key: "marseille-fr", countryIso: "FR", label: { ru: "Марсель", en: "Marseille" }, lat: 43.2965, lng: 5.3698 },
  { key: "berlin-de", countryIso: "DE", label: { ru: "Берлин", en: "Berlin" }, lat: 52.52, lng: 13.405 },
  { key: "munich-de", countryIso: "DE", label: { ru: "Мюнхен", en: "Munich" }, lat: 48.1351, lng: 11.582 },
  { key: "hamburg-de", countryIso: "DE", label: { ru: "Гамбург", en: "Hamburg" }, lat: 53.5511, lng: 9.9937 },
  { key: "cologne-de", countryIso: "DE", label: { ru: "Кёльн", en: "Cologne" }, lat: 50.9375, lng: 6.9603 },
  { key: "london-gb", countryIso: "GB", label: { ru: "Лондон", en: "London" }, lat: 51.5072, lng: -0.1276 },
  { key: "edinburgh-gb", countryIso: "GB", label: { ru: "Эдинбург", en: "Edinburgh" }, lat: 55.9533, lng: -3.1883 },
  { key: "manchester-gb", countryIso: "GB", label: { ru: "Манчестер", en: "Manchester" }, lat: 53.4808, lng: -2.2426 },
  { key: "birmingham-gb", countryIso: "GB", label: { ru: "Бирмингем", en: "Birmingham" }, lat: 52.4862, lng: -1.8904 },
  { key: "madrid-es", countryIso: "ES", label: { ru: "Мадрид", en: "Madrid" }, lat: 40.4168, lng: -3.7038 },
  { key: "barcelona-es", countryIso: "ES", label: { ru: "Барселона", en: "Barcelona" }, lat: 41.3874, lng: 2.1686 },
  { key: "valencia-es", countryIso: "ES", label: { ru: "Валенсия", en: "Valencia" }, lat: 39.4699, lng: -0.3763 },
  { key: "seville-es", countryIso: "ES", label: { ru: "Севилья", en: "Seville" }, lat: 37.3891, lng: -5.9845 },
  { key: "lisbon-pt", countryIso: "PT", label: { ru: "Лиссабон", en: "Lisbon" }, lat: 38.7223, lng: -9.1393 },
  { key: "porto-pt", countryIso: "PT", label: { ru: "Порту", en: "Porto" }, lat: 41.1579, lng: -8.6291 },
  { key: "prague-cz", countryIso: "CZ", label: { ru: "Прага", en: "Prague" }, lat: 50.0755, lng: 14.4378 },
  { key: "brno-cz", countryIso: "CZ", label: { ru: "Брно", en: "Brno" }, lat: 49.1951, lng: 16.6068 },
  { key: "vienna-at", countryIso: "AT", label: { ru: "Вена", en: "Vienna" }, lat: 48.2082, lng: 16.3738 },
  { key: "salzburg-at", countryIso: "AT", label: { ru: "Зальцбург", en: "Salzburg" }, lat: 47.8095, lng: 13.055 },
  { key: "amsterdam-nl", countryIso: "NL", label: { ru: "Амстердам", en: "Amsterdam" }, lat: 52.3676, lng: 4.9041 },
  { key: "rotterdam-nl", countryIso: "NL", label: { ru: "Роттердам", en: "Rotterdam" }, lat: 51.9244, lng: 4.4777 },
  { key: "brussels-be", countryIso: "BE", label: { ru: "Брюссель", en: "Brussels" }, lat: 50.8503, lng: 4.3517 },
  { key: "bruges-be", countryIso: "BE", label: { ru: "Брюгге", en: "Bruges" }, lat: 51.2093, lng: 3.2247 },
  { key: "zurich-ch", countryIso: "CH", label: { ru: "Цюрих", en: "Zurich" }, lat: 47.3769, lng: 8.5417 },
  { key: "geneva-ch", countryIso: "CH", label: { ru: "Женева", en: "Geneva" }, lat: 46.2044, lng: 6.1432 },
  { key: "stockholm-se", countryIso: "SE", label: { ru: "Стокгольм", en: "Stockholm" }, lat: 59.3293, lng: 18.0686 },
  { key: "gothenburg-se", countryIso: "SE", label: { ru: "Гётеборг", en: "Gothenburg" }, lat: 57.7089, lng: 11.9746 },
  { key: "copenhagen-dk", countryIso: "DK", label: { ru: "Копенгаген", en: "Copenhagen" }, lat: 55.6761, lng: 12.5683 },
  { key: "aarhus-dk", countryIso: "DK", label: { ru: "Орхус", en: "Aarhus" }, lat: 56.1629, lng: 10.2039 },
  { key: "oslo-no", countryIso: "NO", label: { ru: "Осло", en: "Oslo" }, lat: 59.9139, lng: 10.7522 },
  { key: "bergen-no", countryIso: "NO", label: { ru: "Берген", en: "Bergen" }, lat: 60.3913, lng: 5.3221 },
  { key: "helsinki-fi", countryIso: "FI", label: { ru: "Хельсинки", en: "Helsinki" }, lat: 60.1699, lng: 24.9384 },
  { key: "dublin-ie", countryIso: "IE", label: { ru: "Дублин", en: "Dublin" }, lat: 53.3498, lng: -6.2603 },
  { key: "budapest-hu", countryIso: "HU", label: { ru: "Будапешт", en: "Budapest" }, lat: 47.4979, lng: 19.0402 },
  { key: "bucharest-ro", countryIso: "RO", label: { ru: "Бухарест", en: "Bucharest" }, lat: 44.4268, lng: 26.1025 },
  { key: "sofia-bg", countryIso: "BG", label: { ru: "София", en: "Sofia" }, lat: 42.6977, lng: 23.3219 },
  { key: "athens-gr", countryIso: "GR", label: { ru: "Афины", en: "Athens" }, lat: 37.9838, lng: 23.7275 },
  { key: "thessaloniki-gr", countryIso: "GR", label: { ru: "Салоники", en: "Thessaloniki" }, lat: 40.6401, lng: 22.9444 },
  { key: "istanbul-tr", countryIso: "TR", label: { ru: "Стамбул", en: "Istanbul" }, lat: 41.0082, lng: 28.9784 },
  { key: "ankara-tr", countryIso: "TR", label: { ru: "Анкара", en: "Ankara" }, lat: 39.9334, lng: 32.8597 },
  { key: "dubai-ae", countryIso: "AE", label: { ru: "Дубай", en: "Dubai" }, lat: 25.2048, lng: 55.2708 },
  { key: "abu-dhabi-ae", countryIso: "AE", label: { ru: "Абу-Даби", en: "Abu Dhabi" }, lat: 24.4539, lng: 54.3773 },
  { key: "doha-qa", countryIso: "QA", label: { ru: "Доха", en: "Doha" }, lat: 25.2854, lng: 51.531 },
  { key: "riyadh-sa", countryIso: "SA", label: { ru: "Эр-Рияд", en: "Riyadh" }, lat: 24.7136, lng: 46.6753 },
  { key: "jeddah-sa", countryIso: "SA", label: { ru: "Джидда", en: "Jeddah" }, lat: 21.4858, lng: 39.1925 },
  { key: "tel-aviv-il", countryIso: "IL", label: { ru: "Тель-Авив", en: "Tel Aviv" }, lat: 32.0853, lng: 34.7818 },
  { key: "jerusalem-il", countryIso: "IL", label: { ru: "Иерусалим", en: "Jerusalem" }, lat: 31.7683, lng: 35.2137 },
  { key: "cairo-eg", countryIso: "EG", label: { ru: "Каир", en: "Cairo" }, lat: 30.0444, lng: 31.2357 },
  { key: "marrakech-ma", countryIso: "MA", label: { ru: "Марракеш", en: "Marrakech" }, lat: 31.6295, lng: -7.9811 },
  { key: "casablanca-ma", countryIso: "MA", label: { ru: "Касабланка", en: "Casablanca" }, lat: 33.5731, lng: -7.5898 },
  { key: "toronto-ca", countryIso: "CA", label: { ru: "Торонто", en: "Toronto" }, lat: 43.6532, lng: -79.3832 },
  { key: "vancouver-ca", countryIso: "CA", label: { ru: "Ванкувер", en: "Vancouver" }, lat: 49.2827, lng: -123.1207 },
  { key: "montreal-ca", countryIso: "CA", label: { ru: "Монреаль", en: "Montreal" }, lat: 45.5017, lng: -73.5673 },
  { key: "mexico-city-mx", countryIso: "MX", label: { ru: "Мехико", en: "Mexico City" }, lat: 19.4326, lng: -99.1332 },
  { key: "guadalajara-mx", countryIso: "MX", label: { ru: "Гвадалахара", en: "Guadalajara" }, lat: 20.6597, lng: -103.3496 },
  { key: "cancun-mx", countryIso: "MX", label: { ru: "Канкун", en: "Cancun" }, lat: 21.1619, lng: -86.8515 },
  { key: "rio-de-janeiro-br", countryIso: "BR", label: { ru: "Рио-де-Жанейро", en: "Rio de Janeiro" }, lat: -22.9068, lng: -43.1729 },
  { key: "sao-paulo-br", countryIso: "BR", label: { ru: "Сан-Паулу", en: "Sao Paulo" }, lat: -23.5558, lng: -46.6396 },
  { key: "buenos-aires-ar", countryIso: "AR", label: { ru: "Буэнос-Айрес", en: "Buenos Aires" }, lat: -34.6037, lng: -58.3816 },
  { key: "santiago-cl", countryIso: "CL", label: { ru: "Сантьяго", en: "Santiago" }, lat: -33.4489, lng: -70.6693 },
  { key: "lima-pe", countryIso: "PE", label: { ru: "Лима", en: "Lima" }, lat: -12.0464, lng: -77.0428 },
  { key: "bogota-co", countryIso: "CO", label: { ru: "Богота", en: "Bogota" }, lat: 4.711, lng: -74.0721 },
  { key: "sydney-au", countryIso: "AU", label: { ru: "Сидней", en: "Sydney" }, lat: -33.8688, lng: 151.2093 },
  { key: "melbourne-au", countryIso: "AU", label: { ru: "Мельбурн", en: "Melbourne" }, lat: -37.8136, lng: 144.9631 },
  { key: "brisbane-au", countryIso: "AU", label: { ru: "Брисбен", en: "Brisbane" }, lat: -27.4698, lng: 153.0251 },
  { key: "auckland-nz", countryIso: "NZ", label: { ru: "Окленд", en: "Auckland" }, lat: -36.8509, lng: 174.7645 },
  { key: "wellington-nz", countryIso: "NZ", label: { ru: "Веллингтон", en: "Wellington" }, lat: -41.2866, lng: 174.7756 },
  { key: "singapore-sg", countryIso: "SG", label: { ru: "Сингапур", en: "Singapore" }, lat: 1.3521, lng: 103.8198 },
  { key: "seoul-kr", countryIso: "KR", label: { ru: "Сеул", en: "Seoul" }, lat: 37.5665, lng: 126.978 },
  { key: "busan-kr", countryIso: "KR", label: { ru: "Пусан", en: "Busan" }, lat: 35.1796, lng: 129.0756 },
  { key: "hong-kong-hk", countryIso: "HK", label: { ru: "Гонконг", en: "Hong Kong" }, lat: 22.3193, lng: 114.1694 },
  { key: "taipei-tw", countryIso: "TW", label: { ru: "Тайбэй", en: "Taipei" }, lat: 25.033, lng: 121.5654 },
  { key: "beijing-cn", countryIso: "CN", label: { ru: "Пекин", en: "Beijing" }, lat: 39.9042, lng: 116.4074 },
  { key: "shanghai-cn", countryIso: "CN", label: { ru: "Шанхай", en: "Shanghai" }, lat: 31.2304, lng: 121.4737 },
  { key: "guangzhou-cn", countryIso: "CN", label: { ru: "Гуанчжоу", en: "Guangzhou" }, lat: 23.1291, lng: 113.2644 },
  { key: "bangkok-th", countryIso: "TH", label: { ru: "Бангкок", en: "Bangkok" }, lat: 13.7563, lng: 100.5018 },
  { key: "chiang-mai-th", countryIso: "TH", label: { ru: "Чиангмай", en: "Chiang Mai" }, lat: 18.7883, lng: 98.9853 },
  { key: "phuket-th", countryIso: "TH", label: { ru: "Пхукет", en: "Phuket" }, lat: 7.8804, lng: 98.3923 },
  { key: "hanoi-vn", countryIso: "VN", label: { ru: "Ханой", en: "Hanoi" }, lat: 21.0278, lng: 105.8342 },
  { key: "ho-chi-minh-vn", countryIso: "VN", label: { ru: "Хошимин", en: "Ho Chi Minh City" }, lat: 10.8231, lng: 106.6297 },
  { key: "da-nang-vn", countryIso: "VN", label: { ru: "Дананг", en: "Da Nang" }, lat: 16.0544, lng: 108.2022 },
  { key: "jakarta-id", countryIso: "ID", label: { ru: "Джакарта", en: "Jakarta" }, lat: -6.2088, lng: 106.8456 },
  { key: "denpasar-id", countryIso: "ID", label: { ru: "Денпасар", en: "Denpasar" }, lat: -8.6500, lng: 115.2167 },
  { key: "bali-id", countryIso: "ID", label: { ru: "Бали", en: "Bali" }, lat: -8.4095, lng: 115.1889 },
  { key: "mumbai-in", countryIso: "IN", label: { ru: "Мумбаи", en: "Mumbai" }, lat: 19.076, lng: 72.8777 },
  { key: "delhi-in", countryIso: "IN", label: { ru: "Дели", en: "Delhi" }, lat: 28.6139, lng: 77.209 },
  { key: "bengaluru-in", countryIso: "IN", label: { ru: "Бангалор", en: "Bengaluru" }, lat: 12.9716, lng: 77.5946 },
  { key: "goa-in", countryIso: "IN", label: { ru: "Гоа", en: "Goa" }, lat: 15.2993, lng: 74.124 },
  { key: "tbilisi-ge", countryIso: "GE", label: { ru: "Тбилиси", en: "Tbilisi" }, lat: 41.7151, lng: 44.8271 },
  { key: "batumi-ge", countryIso: "GE", label: { ru: "Батуми", en: "Batumi" }, lat: 41.6168, lng: 41.6367 },
  { key: "yerevan-am", countryIso: "AM", label: { ru: "Ереван", en: "Yerevan" }, lat: 40.1792, lng: 44.4991 },
  { key: "almaty-kz", countryIso: "KZ", label: { ru: "Алматы", en: "Almaty" }, lat: 43.2389, lng: 76.8897 },
  { key: "astana-kz", countryIso: "KZ", label: { ru: "Астана", en: "Astana" }, lat: 51.1694, lng: 71.4491 },
  { key: "cape-town-za", countryIso: "ZA", label: { ru: "Кейптаун", en: "Cape Town" }, lat: -33.9249, lng: 18.4241 },
  { key: "johannesburg-za", countryIso: "ZA", label: { ru: "Йоханнесбург", en: "Johannesburg" }, lat: -26.2041, lng: 28.0473 },
  { key: "nairobi-ke", countryIso: "KE", label: { ru: "Найроби", en: "Nairobi" }, lat: -1.2921, lng: 36.8219 },
];

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9а-яё]+/gi, " ")
    .trim();
}

function buildLegacyCityOption(cityName, countryIso = "") {
  const trimmedName = String(cityName || "").trim();

  return {
    key: `legacy-${countryIso || "xx"}-${normalizeText(trimmedName).replace(/\s+/g, "-")}`,
    countryIso,
    label: { ru: trimmedName, en: trimmedName },
    legacy: true,
  };
}

export { COLOR_OPTIONS, COLLECTION_OPTIONS, WORLD_CITIES };

export function ensureArray(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (value == null || value === "") {
    return [];
  }

  return [value].filter(Boolean);
}

export function getLocalizedOptionLabel(option, language = "ru") {
  if (!option) return "";
  return option.label?.[language] || option.label?.ru || option.label?.en || option.key || "";
}

export function getColorOption(key = "") {
  return COLOR_OPTIONS.find((option) => option.key === key) || null;
}

export function getCollectionOption(key = "") {
  return (
    COLLECTION_OPTIONS.find((option) => {
      return (
        option.key === key ||
        option.label?.ru === key ||
        option.label?.en === key
      );
    }) || null
  );
}

export function getCityOptionByKey(key = "") {
  return WORLD_CITIES.find((city) => city.key === key) || null;
}

export function findCityOption({ cityKey = "", cityName = "", countryIso = "" } = {}) {
  if (cityKey) {
    const optionByKey = getCityOptionByKey(cityKey);
    if (optionByKey) return optionByKey;
  }

  const normalizedName = normalizeText(cityName);
  if (!normalizedName) return null;

  return (
    WORLD_CITIES.find((city) => {
      if (countryIso && city.countryIso !== countryIso) {
        return false;
      }

      return [city.label?.ru, city.label?.en, city.key]
        .filter(Boolean)
        .some((candidate) => normalizeText(candidate) === normalizedName);
    }) || null
  );
}

export function getCityDisplayName(cityKey = "", fallbackCity = "", language = "ru") {
  const option = findCityOption({ cityKey, cityName: fallbackCity });
  if (option) {
    return getLocalizedOptionLabel(option, language);
  }

  return String(fallbackCity || "").trim();
}

export function getColorLabels(colorKeys = [], language = "ru") {
  return ensureArray(colorKeys)
    .map((key) => getColorOption(key))
    .filter(Boolean)
    .map((option) => getLocalizedOptionLabel(option, language));
}

export function getCollectionLabels(collectionKeys = [], language = "ru") {
  return ensureArray(collectionKeys)
    .map((key) => {
      const option = getCollectionOption(key);
      return option ? getLocalizedOptionLabel(option, language) : String(key);
    })
    .filter(Boolean);
}

export function getTypeValues(collectionKeys = [], legacyType = "") {
  const values = ensureArray(collectionKeys);

  if (values.length > 0) {
    return values;
  }

  if (!legacyType) {
    return [];
  }

  return String(legacyType)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getTypeLabels(typeValues = [], language = "ru") {
  return ensureArray(typeValues)
    .map((value) => {
      const option = getCollectionOption(value);
      return option ? getLocalizedOptionLabel(option, language) : String(value);
    })
    .filter(Boolean);
}

export function buildTypeOptions({
  selectedValues = [],
  existingValues = [],
  language = "ru",
} = {}) {
  const presetOptions = COLLECTION_OPTIONS.map((option) => ({
    value: option.key,
    label: getLocalizedOptionLabel(option, language),
    isPreset: true,
  }));

  const seen = new Set(presetOptions.map((option) => option.value));
  const customOptions = [...ensureArray(existingValues), ...ensureArray(selectedValues)]
    .filter(Boolean)
    .filter((value) => {
      if (seen.has(value)) {
        return false;
      }

      seen.add(value);
      return true;
    })
    .map((value) => ({
      value,
      label: getCollectionOption(value)
        ? getLocalizedOptionLabel(getCollectionOption(value), language)
        : String(value),
      isPreset: false,
    }));

  return [...presetOptions, ...customOptions];
}

export function getCityOptionsForCountry(countryIso = "", legacyValues = []) {
  const curated = WORLD_CITIES.filter((city) => !countryIso || city.countryIso === countryIso);
  const legacyOptions = ensureArray(legacyValues)
    .map((cityName) => buildLegacyCityOption(cityName, countryIso))
    .filter((option) => {
      return !curated.some((city) => {
        return normalizeText(getLocalizedOptionLabel(city, "en")) === normalizeText(option.label.en);
      });
    });

  const uniqueOptions = [...curated, ...legacyOptions].filter((option, index, array) => {
    return array.findIndex((candidate) => candidate.key === option.key) === index;
  });

  return uniqueOptions.sort((a, b) => {
    return getLocalizedOptionLabel(a, "en").localeCompare(getLocalizedOptionLabel(b, "en"), "en");
  });
}

export function buildCityFilterValue(cityKey = "", cityName = "", countryIso = "") {
  if (cityKey) return cityKey;
  if (!cityName) return "";

  const legacyOption = buildLegacyCityOption(cityName, countryIso);
  return legacyOption.key;
}
