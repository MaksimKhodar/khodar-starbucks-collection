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
