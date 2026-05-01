-- migrate_mugs_city_id.sql
-- Заполняет новое поле mugs.city_id на основе существующих значений city_key и city.

-- 1. Сначала пробуем сопоставить по city_key
UPDATE mugs m
SET city_id = c.id
FROM cities c
WHERE m.city_id IS NULL
  AND m.city_key IS NOT NULL
  AND m.city_key <> ''
  AND c.key = m.city_key;

-- 2. Если city_key отсутствует, пробуем сопоставить по названию города и стране
UPDATE mugs m
SET city_id = c.id
FROM cities c
WHERE m.city_id IS NULL
  AND m.city IS NOT NULL
  AND trim(m.city) <> ''
  AND lower(trim(m.city)) IN (
    lower(trim(c.name_en)),
    lower(trim(c.name_ru))
  )
  AND m.country_id = c.country_id;

-- 3. Опциональная проверка: импортированные строки с city_id всё ещё пустые
SELECT m.id, m.country_id, m.city, m.city_key
FROM mugs m
WHERE m.city_id IS NULL
  AND (m.city_key IS NOT NULL OR m.city IS NOT NULL)
LIMIT 100;
