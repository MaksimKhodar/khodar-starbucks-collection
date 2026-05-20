// ── Person URL slug ───────────────────────────────────────────────────────────

const _TRANSLIT = {а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya"};

export function personSlug(p) {
  const name = [p.first_name, p.last_name].filter(Boolean).join("-");
  const slug = String(name || "").toLowerCase()
    .split("").map(c => _TRANSLIT[c] ?? c).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || String(p.id);
}

/**
 * Нормализует ISO-код страны (2-буквенный)
 * @param {string} value - ISO-код страны
 * @returns {string} - Нормализованный код в верхнем регистре
 */
export function normalizeIso2(value) {
  return (value || "").toUpperCase().trim();
}

/**
 * Форматирует дату для отображения (берёт первые 7 символов: YYYY-MM)
 * @param {string} value - Дата для форматирования
 * @returns {string} - Отформатированная дата или тире
 */
export function formatDate(value) {
  if (!value) return "—";
  return String(value).slice(0, 7);
}

// Collection started November 2011 — count full elapsed years from that date
export function getCollectionYears() {
  return Math.floor((Date.now() - new Date(2011, 10, 1).getTime()) / (365.25 * 24 * 3600 * 1000));
}

// Russian: год / года / лет
export function ruYears(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m100 >= 11 && m100 <= 19) return `${n} лет`;
  if (m10 === 1) return `${n} год`;
  if (m10 >= 2 && m10 <= 4) return `${n} года`;
  return `${n} лет`;
}

// Russian: страна / страны / стран
export function ruCountries(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m100 >= 11 && m100 <= 19) return `${n} стран`;
  if (m10 === 1) return `${n} страна`;
  if (m10 >= 2 && m10 <= 4) return `${n} страны`;
  return `${n} стран`;
}

/**
 * Форматирует дату и время в локальный читаемый вид
 * @param {string} value - ISO-строка даты/времени
 * @param {string} locale - язык форматирования
 * @returns {string}
 */
export function formatDateTime(value, locale = "ru-RU") {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
