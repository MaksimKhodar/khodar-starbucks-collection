-- refactor_db_schema.sql
-- Полная нормализация схемы базы данных для приложения Khodar Starbucks Collection.
-- Этот скрипт создаёт / дополняет таблицы и поля, необходимые для стабильной работы.
-- Legacy-поля city и city_key оставляются на время миграции; удалить их можно после завершения перехода.

create extension if not exists pgcrypto;

-- Страны
create table if not exists countries (
  id bigint generated always as identity primary key,
  iso2_code varchar not null unique,
  name_en text not null,
  name_ru text,
  has_starbucks_current boolean not null default false,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table countries add column if not exists has_starbucks_current boolean not null default false;
alter table countries add column if not exists is_visible boolean not null default true;
alter table countries add column if not exists created_at timestamptz not null default now();
alter table countries add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_countries_iso2_code on countries(iso2_code);
create index if not exists idx_countries_is_visible on countries(is_visible);

-- Города
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

alter table cities add column if not exists key text;
alter table cities add column if not exists country_id bigint references countries(id) on delete cascade;
alter table cities add column if not exists name_en text;
alter table cities add column if not exists name_ru text;
alter table cities add column if not exists latitude double precision;
alter table cities add column if not exists longitude double precision;
alter table cities add column if not exists is_active boolean not null default true;
alter table cities add column if not exists created_at timestamptz not null default now();
alter table cities add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_cities_country_id on cities(country_id);
create index if not exists idx_cities_country_name_en on cities(country_id, name_en);

-- Люди
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  first_name varchar not null,
  last_name varchar not null,
  bio text,
  avatar_image_path text,
  instagram_url text,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table people add column if not exists avatar_image_path text;
alter table people add column if not exists instagram_url text;
alter table people add column if not exists is_visible boolean not null default true;
alter table people add column if not exists created_at timestamptz not null default now();
alter table people add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_people_first_name on people(first_name);
create index if not exists idx_people_last_name on people(last_name);
create index if not exists idx_people_is_visible on people(is_visible);

-- Картинки кружек
create table if not exists mug_images (
  id uuid primary key default gen_random_uuid(),
  mug_id bigint not null references mugs(id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0,
  alt_text text,
  created_at timestamptz not null default now()
);

alter table mug_images add column if not exists mug_id bigint references mugs(id) on delete cascade;
alter table mug_images add column if not exists storage_path text;
alter table mug_images add column if not exists sort_order int not null default 0;
alter table mug_images add column if not exists alt_text text;
alter table mug_images add column if not exists created_at timestamptz not null default now();

create index if not exists idx_mug_images_mug_id on mug_images(mug_id);
create index if not exists idx_mug_images_sort_order on mug_images(mug_id, sort_order);

-- Кружки
alter table mugs add column if not exists country_id bigint references countries(id) on delete set null;
alter table mugs add column if not exists city_id uuid references cities(id) on delete set null;
alter table mugs add column if not exists city_key text;
alter table mugs add column if not exists city text;
alter table mugs add column if not exists brought_by_person_id uuid references people(id) on delete set null;
alter table mugs add column if not exists brought_by_person_ids uuid[];
alter table mugs add column if not exists color_keys text[] not null default '{}';
alter table mugs add column if not exists collection_keys text[] not null default '{}';
alter table mugs add column if not exists created_at timestamptz not null default now();
alter table mugs add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_mugs_country_id on mugs(country_id);
create index if not exists idx_mugs_city_id on mugs(city_id);
create index if not exists idx_mugs_brought_by_person_id on mugs(brought_by_person_id);

-- Помощь при миграции city_id
update mugs m
set city_id = c.id
from cities c
where m.city_id is null
  and m.city_key is not null
  and trim(m.city_key) <> ''
  and c.key = m.city_key;

update mugs m
set city_id = c.id
from cities c
where m.city_id is null
  and m.city is not null
  and trim(m.city) <> ''
  and lower(trim(m.city)) in (
    lower(trim(c.name_en)),
    lower(trim(c.name_ru))
  )
  and m.country_id = c.country_id;

update mugs m
set city_key = c.key
from cities c
where m.city_id = c.id
  and (m.city_key is null or trim(m.city_key) = '');

-- Помощь при миграции brought_by_person_id
update mugs m
set brought_by_person_id = p.id
from people p
where m.brought_by_person_id is null
  and array_length(m.brought_by_person_ids, 1) = 1
  and p.id = m.brought_by_person_ids[1];

-- Проверки: найдите кружки с частичной миграцией
select id, country_id, city, city_key, city_id, brought_by_person_id, brought_by_person_ids
from mugs
where (city_id is null and (city_key is not null or city is not null))
   or (brought_by_person_id is null and array_length(brought_by_person_ids, 1) > 0)
limit 100;

-- После полной миграции и перехода к city_id можно удалить legacy-поля
-- alter table mugs drop column if exists city;
-- alter table mugs drop column if exists city_key;
-- alter table mugs drop column if exists brought_by_person_ids;
