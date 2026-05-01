# 🎉 Система управления "Люди" — Полное руководство

## ✅ Что было создано

### 1. **Новые компоненты**

#### **PeopleVisualization.jsx** 
- Главная страница для просмотра людей
- Загружает людей с видимостью `is_visible = true`

#### **PeopleGrid.jsx**
- Красивая сетка карточек людей
- Поиск по имени и локации
- Интерактивные карточки с информацией о кружках

#### **PersonDetailModal.jsx**
- Модальное окно с полной информацией о человеке
- Группировка кружек по странам
- Фото профиля и биография
- Список привезённых кружек

#### **PeopleAdmin.jsx**
- Администраторская панель для управления людьми
- CRUD операции (Create, Read, Update, Delete)
- Поиск и фильтрация
- Привязка кружек к людям (через `brought_by_person_id`)

### 2. **Обновления в App.jsx**
- ✅ Добавлен новый import для PeopleVisualization, PeopleAdmin
- ✅ Добавлено состояние `people`
- ✅ Обновлена функция `loadData()` для загрузки данных о людях
- ✅ Добавлена новая вкладка "Люди" в меню
- ✅ Добавлена логика отображения PeopleVisualization для публичного просмотра
- ✅ Добавлена логика отображения PeopleAdmin для администраторов

### 3. **Обновления в translations.js**
- ✅ Добавлена фраза `people: "Люди"` (RU)
- ✅ Добавлена фраза `people: "People"` (EN)

---

## 🗄️ Создание таблиц в Supabase

Выполните эти SQL команды в Supabase SQL Editor:

### **1. Таблица people**

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

-- Добавьте индекс для быстрого поиска
CREATE INDEX idx_people_first_name ON people(first_name);
CREATE INDEX idx_people_last_name ON people(last_name);
CREATE INDEX idx_people_is_visible ON people(is_visible);
```

### **2. Обновление таблицы mugs**

```sql
-- Добавьте колонку для связи с людьми (если её ещё нет)
ALTER TABLE mugs 
ADD COLUMN brought_by_person_id UUID REFERENCES people(id) ON DELETE SET NULL;

-- Добавьте индекс для быстрого поиска
CREATE INDEX idx_mugs_brought_by_person_id ON mugs(brought_by_person_id);
```

### **3. Хранилище для аватаров люде**

```
Создайте публичное хранилище в Supabase Storage:
- Название: people-avatars
- Видимость: PUBLIC
```

Или используйте SQL консоль:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('people-avatars', 'people-avatars', true);
```

---

## 📝 Как использовать

### **Для пользователей (просмотр)**

1. Нажимаете вкладку "Люди" в заголовке
2. Видите сетку карточек людей
3. Кликаете на карточку → открывается модал с:
   - Фото профиля
   - Именем и локацией
   - Биографией
   - Списком привезённых кружек по странам
   - Галереей кружек от человека

### **Для администраторов (управление)**

#### В основной App.jsx есть скрытая вкладка admin:
- Добавьте кнопку для переключения в режим администратора (опционально)
- Или используйте прямой URL: добавьте логику для переключения в `people-admin` режим

Текущий код поддерживает:
```javascript
setCurrentView("people-admin") // Переводит в админ-режим
```

#### На админ-панели:
1. ✅ Создание человека
   - Введите имя (обязательное)
   - Локацию (откуда он)
   - Биографию
   - Выберите видимость

2. ✅ Редактирование
   - Кликните "Редактировать" на карточке
   - Измените данные
   - Сохраните

3. ✅ Удаление
   - Кликните "Удалить"
   - Подтвердите

---

## 🔄 Миграция существующих данных

### **План переноса данных из `brought_by` в таблицу people:**

1. **Соберите уникальные имена людей из поля `brought_by` в таблице mugs**
2. **Вставьте их в таблицу people** (разберите на имя/фамилию или используйте первое слово как имя)
3. **Обновите кружки чтобы привязать их к людям**

Пример SQL скрипта:
```sql
-- 1. Вставьте уникальных людей из brought_by
-- ВАЖНО: Это простой пример. Потребуется ручная разборка имён на first_name/last_name
INSERT INTO people (first_name, last_name, is_visible)
SELECT 
  SPLIT_PART(brought_by, ' ', 1) as first_name,
  COALESCE(SPLIT_PART(brought_by, ' ', 2), '') as last_name,
  TRUE
FROM mugs
WHERE brought_by IS NOT NULL AND brought_by != ''
GROUP BY brought_by
ON CONFLICT DO NOTHING;

-- 2. Обновите кружки чтобы привязать к людям
UPDATE mugs m
SET brought_by_person_id = p.id
FROM people p
WHERE CONCAT(p.first_name, ' ', p.last_name) = m.brought_by
AND m.brought_by_person_id IS NULL;
```

---

## 🎨 Структура данных

### **TableStructure: people**

| Поле | Тип | Обязательное | Описание |
|------|------|--------|----------|
| id | UUID | ✅ | Уникальный идентификатор |
| first_name | VARCHAR | ✅ | Имя человека |
| last_name | VARCHAR | ✅ | Фамилия человека |
| bio | TEXT | ❌ | Биография, описание человека |
| avatar_image_path | VARCHAR | ❌ | Путь к фото профиля в хранилище |
| is_visible | BOOLEAN | ✅ | Видимость (по умолчанию TRUE) |
| created_at | TIMESTAMP | ✅ | Дата создания |
| updated_at | TIMESTAMP | ✅ | Дата последнего обновления |

### **Изменения в mugs:**

| Поле | Тип | Обязательное | Описание |
|------|------|--------|----------|
| brought_by_person_id | UUID | ❌ | Связь на человека (внешний ключ) |

---

## 🔐 Политики безопасности Supabase (RLS)

Добавьте эти политики для таблицы `people`:

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

## 📸 Загрузка фото профиля

Текущий код ожидает URL:
```
{SUPABASE_URL}/storage/v1/object/public/people-avatars/{avatar_image_path}
```

Примеры:
- `people-avatars/maxim-profile.jpg`
- `people-avatars/friend-01.png`

---

## 🎯 Следующие шаги

1. **✅ Создайте таблицы в Supabase** (скопируйте SQL выше)
2. **✅ Создайте хранилище people-avatars**
3. **✅ Миграция существующих данных** (опционально)
4. **✅ Протестируйте приложение**
5. **✅ Загружайте фото людей в админ-панели** (когда будет сделана загрузка)

---

## 💡 Возможные улучшения

- ☐ Загрузка фото профиля в админ-панели
- ☐ Интеграция с GlobeMap для показа локаций людей на карте
- ☐ Страницы профилей людей (индивидуальные URL)
- ☐ Социальные медиа ссылки (Facebook, Instagram, LinkedIn)
- ☐ Рейтинги "Лучший путешественник" по кружкам
- ☐ Хронология путешествий каждого человека

---

## 🚀 Запуск и тестирование

```bash
npm run dev
```

После запуска:
1. Откройте http://localhost:5173
2. Перейдите на вкладку "Люди"
3. Вы должны увидеть пустую страницу (люди ещё не добавлены в БД)

Чтобы добавить людей как администратор:
- Нажимают на вкладку "Кружки" в админ-разделе
- Обновляют кружки с привязкой к людям
- Или используют админ-панель "People Admin" (при добавлении такого режима)
