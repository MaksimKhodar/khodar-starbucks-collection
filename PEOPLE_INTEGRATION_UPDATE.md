# 🔄 Обновление: Интеграция людей с кружками

## ✅ Что было изменено

### 1. **Обновлена система управления людьми** ✓
- Структура данных изменена с `{name, location_from}` на `{first_name, last_name}`
- Добавлена загрузка фото профиля в `PeopleAdmin`
- Фото теперь загружается в хранилище `mug-images` (общее со кружками)

### 2. **Новый компонент `PersonSelect.jsx`** ✓
- Выпадающий список всех людей
- Возможность создать нового человека прямо в форме кружки
- Показывает выбранного человека с галочкой

### 3. **Обновлена форма редактирования кружки (`MugsAdmin`)** ✓
- ✅ Добавлено поле `PersonSelect` для выбора человека
- ✅ Автоматически сохраняется связь `brought_by_person_id`
- ✅ Можно создать нового человека на лету при редактировании кружки
- ✅ Сохранено лишнее поле `brought_by` (текст) для совместимости

### 4. **Обновлены компоненты визуализации** ✓
- `PersonDetailModal` — показывает все кружки, привезённые человеком
- `PeopleGrid` — карточки людей с счётчиком кружек
- `PeopleVisualization` — главная страница раздела "Люди"
- Все компоненты используют `first_name + last_name`

### 5. **Обновлён `App.jsx`** ✓
- Загружает `brought_by_person_id` вместе с кружками
- Загружает `first_name, last_name` для людей

---

## 📋 Необходимые обновления в Supabase

### **1. Создайте новую таблицу `people`**

```sql
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR NOT NULL,
  last_name VARCHAR NOT NULL,
  bio TEXT,
  avatar_image_path VARCHAR,
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_people_first_name ON people(first_name);
CREATE INDEX idx_people_last_name ON people(last_name);
CREATE INDEX idx_people_is_visible ON people(is_visible);
```

### **2. Обновите таблицу `mugs`** (если её ещё нет колонки `brought_by_person_id`)

```sql
ALTER TABLE mugs 
ADD COLUMN brought_by_person_id UUID REFERENCES people(id) ON DELETE SET NULL;

CREATE INDEX idx_mugs_brought_by_person_id ON mugs(brought_by_person_id);
```

---

## 🔄 Миграция существующих данных

### **Вариант 1: Ручная миграция (рекомендуется первый раз)**

1. Откройте таблицу `mugs` в Supabase и посмотрите все уникальные значения в поле `brought_by`
2. Разберите каждое имя на first_name и last_name вручную (или используйте скрипт ниже)
3. Создайте людей в таблице `people` через админ-панель приложения

### **Вариант 2: SQL автоматизация**

```sql
-- 1. Вставьте людей из таблицы brought_by
-- ВАЖНО: Это предполагает формат "FirstName LastName"
INSERT INTO people (first_name, last_name, is_visible)
SELECT 
  TRIM(SPLIT_PART(brought_by, ' ', 1)) as first_name,
  COALESCE(TRIM(SPLIT_PART(brought_by, ' ', 2)), 'Unknown') as last_name,
  TRUE
FROM mugs
WHERE brought_by IS NOT NULL AND brought_by != ''
ON CONFLICT DO NOTHING
GROUP BY brought_by;

-- 2. Привяжите кружки к людям
UPDATE mugs m
SET brought_by_person_id = p.id
FROM people p
WHERE CONCAT(p.first_name, ' ', p.last_name) = TRIM(m.brought_by)
AND m.brought_by_person_id IS NULL;
```

**⚠️ ВНИМАНИЕ:** Если в вашем `brought_by` нет ясного разделения на имя и фамилию (например, только "Maxim"), выполните скрипт и затем отредактируйте людей через админ-панель.

---

## 🎯 Как использовать

### **Создание нового человека (что-то вроде обычного потока)**

1. Перейдите в админ-раздел "Люди" (вкладка "Люди", если у вас есть админ-доступ)
2. Нажимите "+ Новый человек"
3. Введите имя и фамилию
4. (Опционально) Загрузите фото профиля
5. (Опционально) Добавьте биографию
6. Нажимите "Сохранить"

### **Привязка человека к кружке при редактировании**

1. Откройте админ-раздел "Кружки"
2. Нажимите "Редактировать" на нужной кружке
3. В поле "Кто привёз (источник)" выберите человека из выпадающего списка
4. Или создайте нового человека нажав "+ Новый"
5. Нажимите "Сохранить"
6. Система автоматически заполнит текстовое поле `brought_by`

### **Просмотр профиля человека и его кружек**

1. Нажимите вкладку "Люди"
2. Видите сетку карточек всех людей
3. Нажимите на карточку → открывается подробный профиль
4. В профиле видны:
   - Фото
   - Имя и фамилия
   - Биография
   - Список стран, откуда он привез кружки
   - Галерея всех его кружек

---

## 📸 Хранилище фото

Все фото (как кружек, так и профилей людей) теперь хранятся в одном месте:

```
Bucket: mug-images
Path: mugs/ — фото кружек
Path: people/ — фото профилей (пример: people/maxim-avatar.jpg)
```

или можно просто сохранять с уникальными ID:
```
mug-images/uuid-1234-avatar.jpg
```

---

## 🔐 Политики безопасности RLS (опционально)

Если вы используете Row-Level Security в Supabase:

```sql
-- Читать людей может каждый (если is_visible = true)
CREATE POLICY "Anyone can read visible people"
ON people FOR SELECT
USING (is_visible = true);

-- Администраторы могут создавать/обновлять/удалять
CREATE POLICY "Admins can manage people"
ON people FOR ALL
USING (auth.jwt() ->> 'role' = 'admin');
```

---

## 📝 Структура компонентов

```
App.jsx
├── loadData() — загружает countries, mugs, people
├── PeopleVisualization (публичный раздел "Люди")
│   └── PeopleGrid
│       └── PersonDetailModal
└── PeopleAdmin (админ-панель)
    └── PersonSelect (в MugsAdmin)
```

---

## 🧪 Тестирование

1. Запустите приложение: `npm run dev`
2. Перейдите в админ-раздел кружек
3. Откройте/создайте кружку
4. Проверьте, что `PersonSelect` загружается и работает
5. Создайте нового человека на лету
6. Сохраните кружку
7. Перейдите на вкладку "Люди" и проверьте, что там появился новый человек
8. Нажимите на карточку человека и проверьте, что видны его кружки

---

## 🛠️ Возможные проблемы и решения

### **Проблема: PersonSelect не загружается**
- ✅ Убедитесь, что таблица `people` существует в Supabase
- ✅ Проверьте консоль браузера на ошибки
- ✅ Перезагрузите страницу

### **Проблема: Фото не загружается**
- ✅ Убедитесь, что хранилище `mug-images` публичное
- ✅ Проверьте, что путь в `avatar_image_path` правильный
- ✅ Используйте путь вида: `uuid-file-name.jpg` (без папки)

### **Проблема: Связь between муг и человека не сохраняется**
- ✅ Проверьте, что `brought_by_person_id` есть в таблице `mugs`
- ✅ Убедитесь, что вы выбрали человека в `PersonSelect`
- ✅ Проверьте консоль на ошибки при сохранении

---

## ✨ Следующие улучшения (опционально)

- ☐ Автоматическое заполнение `brought_by` из `first_name + last_name`
- ☐ Социальные медиа ссылки для людей (Instagram, LinkedIn, Facebook)
- ☐ Интеграция с GlobeMap для показа локаций людей
- ☐ Страницы профилей людей с прямыми URL-адресами
- ☐ Рейтинг "Лучший путешественник" по количеству кружек
- ☐ Хронология путешествий каждого человека
