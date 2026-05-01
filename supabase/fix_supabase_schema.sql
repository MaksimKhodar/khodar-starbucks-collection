-- fix_supabase_schema.sql
-- Исправление схемы Supabase для текущей версии приложения
-- Включает таблицу people, таблицу mug_images и недостающие поля в mugs

create extension if not exists pgcrypto;

-- Таблица people должна содержать instagram_url, avatar_image_path и поля видимости
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  first_name varchar not null,
  last_name varchar not null,
  bio text,
  avatar_image_path varchar,
  instagram_url text,
  is_visible boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_people_first_name on people(first_name);
create index if not exists idx_people_last_name on people(last_name);
create index if not exists idx_people_is_visible on people(is_visible);

alter table people add column if not exists instagram_url text;

-- Таблица mug_images нужна для вложенного select в запросе mugs
create table if not exists mug_images (
  id uuid primary key default gen_random_uuid(),
  mug_id bigint not null references mugs(id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0,
  alt_text text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mug_images_mug_id on mug_images(mug_id);
create index if not exists idx_mug_images_sort_order on mug_images(mug_id, sort_order);

-- Обновление таблицы mugs: поле для связи с людьми и новые метаданные
alter table mugs add column if not exists brought_by_person_id uuid references people(id) on delete set null;
alter table mugs add column if not exists city_id uuid references cities(id) on delete set null;
alter table mugs add column if not exists city_key text;
alter table mugs add column if not exists color_keys text[] not null default '{}';
alter table mugs add column if not exists collection_keys text[] not null default '{}';
alter table mugs add column if not exists created_at timestamptz not null default now();
alter table mugs add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_mugs_brought_by_person_id on mugs(brought_by_person_id);

-- Дополнительные поля для countries, если их нет
alter table countries add column if not exists has_starbucks_current boolean default false;
alter table countries add column if not exists is_visible boolean default true;
