export function getLocalizedName(item, language, fallback = '') {
  if (!item) return fallback;

  const isRu = language === 'ru';

  if (isRu) {
    return item.name_ru || item.name_en || fallback;
  }

  return item.name_en || item.name_ru || fallback;
}

export function getLocalizedCountryName(country, language) {
  return getLocalizedName(country, language, country?.iso2_code || '');
}

export function getLocalizedCityName(city, language) {
  return getLocalizedName(city, language, '');
}

export function getLocalizedStateName(cityOrState, language) {
  if (!cityOrState) return '';

  const isRu = language === 'ru';

  if (isRu) {
    return cityOrState.state_name_ru || cityOrState.name_ru || cityOrState.state_name_en || cityOrState.name_en || '';
  }

  return cityOrState.state_name_en || cityOrState.name_en || cityOrState.state_name_ru || cityOrState.name_ru || '';
}

export function sortByLocalizedName(items, language, getName) {
  const locale = language === 'ru' ? 'ru' : 'en';

  return [...items].sort((a, b) => {
    const nameA = getName(a, language) || '';
    const nameB = getName(b, language) || '';

    return nameA.localeCompare(nameB, locale, {
      sensitivity: 'base',
    });
  });
}

export function uniqueBy(items, getKey) {
  const map = new Map();

  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;
    if (!map.has(key)) map.set(key, item);
  }

  return Array.from(map.values());
}