# Обновление схемы `mugs`

Чтобы новые поля из формы и каталога сохранялись в Supabase, добавьте в таблицу `mugs` следующие колонки:

```sql
alter table mugs
  add column if not exists city_key text,
  add column if not exists color_keys text[] not null default '{}',
  add column if not exists collection_keys text[] not null default '{}',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();
```

Если `updated_at` ещё не обновляется автоматически триггером, это не критично: приложение теперь само отправляет новое значение при создании и редактировании кружки.

## Что хранится в новых полях

- `city_key`: ключ города из готового справочника, например `warsaw-pl`
- `color_keys`: массив основных цветов кружки, например `{"green","white"}`
- `collection_keys`: массив типов/тегов кружки, например `{"been-there","new-year"}`

## Что уже использует фронтенд

- форма создания и редактирования кружки
- таблица списка кружек с колонкой последнего редактирования
- сортировка по дате добавления
- фильтры каталога по городу, цвету и типу

## Таблица городов `cities`

Теперь форма кружки берёт города из отдельной таблицы `cities` в Supabase. Для корректного создания кружки таблица должна быть создана и заполнена заранее: после выбора страны список городов формируется именно из записей этой страны в БД.

Готовый SQL лежит здесь:

- [supabase/cities_seed.sql][def]

Что делает этот SQL:

- создаёт таблицу `cities`
- связывает каждый город со страной через `countries.id`
- загружает готовый список городов по `iso2_code` страны
- обновляет существующие записи по `key`, если они уже были
- делает справочник idempotent: скрипт можно запускать повторно после обновления списка городов
- при связывании использует `trim(iso2_code)`, чтобы не ломаться на случайных пробелах в данных

Минимальная структура таблицы:

```sql
create table if not exists cities (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  country_id bigint not null references countries(id) on delete cascade,
  name_en text not null,
  name_ru text,
  latitude double precision,
  longitude double precision,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_id, name_en)
);
```

После выполнения `supabase/cities_seed.sql`:

- в форме создания и редактирования кружки город будет браться из таблицы `cities`
- после выбора страны можно будет выбрать только города этой страны
- значение `city_key` в `mugs` продолжит использоваться как стабильный ключ города
- старые кружки с нестандартными городами всё равно останутся редактируемыми за счёт fallback-логики

Рекомендуемый порядок запуска в Supabase SQL Editor:

1. Выполнить `alter table` для новых колонок таблицы `mugs` из начала этого файла.
2. Выполнить `supabase/cities_seed.sql`.
3. Проверить, что в таблице `cities` появились записи и у каждой указан `country_id`.

Полезные проверки после запуска:

```sql
select count(*) as cities_total from cities;

select
  c.id,
  c.iso2_code,
  c.name_en,
  count(ci.id) as cities_count
from countries c
left join cities ci on ci.country_id = c.id
where upper(trim(c.iso2_code)) = 'AU'
group by c.id, c.iso2_code, c.name_en;

select key, country_id, name_en, is_active
from cities
where key in ('sydney-au', 'melbourne-au', 'brisbane-au');
```

Если `cities_total = 0` или для `AU` счётчик равен `0`, значит сид не связался с таблицей `countries` и города фактически не вставились, даже если SQL выполнился без ошибки.


[def]: /workspaces/khodar-starbucks-collection/supabase/cities_seed.sql
