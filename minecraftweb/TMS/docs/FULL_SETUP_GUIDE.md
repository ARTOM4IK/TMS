# Полный гайд: P2P блоки, MongoDB, сид мира

Этот файл описывает **всю цепочку** от создания мира до сохранения чанков в MongoDB и синхронизации блоков между игроками.

---

## Оглавление

1. [Как всё устроено (схема)](#1-как-всё-устроено-схема)
2. [MongoDB — что хранится](#2-mongodb--что-хранится)
3. [Сервер (backup) — уже готово](#3-сервер-backup--уже-готово)
4. [Клиент TMS — уже готово](#4-клиент-tms--уже-готово)
5. [P2P блоки — как работает](#5-p2p-блоки--как-работает)
6. [Сид мира — путь от формы до генерации](#6-сид-мира--путь-от-формы-до-генерации)
7. [Проверка что всё работает](#7-проверка-что-всё-работает)
8. [Если что-то сломалось](#8-если-что-то-сломалось)

---

## 1. Как всё устроено (схема)

```
[create-world.html]  →  POST /api/worlds  →  MongoDB worlds { seed, name, ... }
       ↓
[menu.html]          →  localStorage ls_currentWorld  →  /world?worldId=...
       ↓
[TMS game.js]        →  GET /api/worlds/:id  →  читает seed
       ↓
[chunk.js]           →  generateTerrain(seed)  →  одинаковый ландшафт у всех
       ↓
[game.js]            →  GET /api/worlds/:id/chunks  →  перезаписывает изменённые чанки
       ↓
Игрок ломает/ставит блок:
  ├─ P2P sendBlockChange  →  другие игроки видят сразу
  └─ PUT /api/worlds/:id/chunks/:x/:z  →  MongoDB сохраняет навсегда
```

---

## 2. MongoDB — что хранится

### Коллекция `users`
Аккаунты: логин, email, bcrypt-пароль, admin, banned.

### Коллекция `worlds`
Метаданные мира:
```json
{
  "worldId": "world-1780578529232",
  "name": "Мой мир",
  "seed": "721377073",
  "worldType": "default",
  "creatorId": 1,
  "creatorUsername": "steve",
  "players": [],
  "createdAt": "2026-06-15T..."
}
```

### Коллекция `chunks`
Сохранённые чанки (только изменённые):
```json
{
  "worldId": "world-1780578529232",
  "chunkX": 0,
  "chunkZ": 0,
  "blocks": "<Buffer 256 KB>",
  "updatedAt": "2026-06-16T..."
}
```

Один чанк = 16×256×16 блоков = 65536 чисел × 4 байта = **262144 байта**.

---

## 3. Сервер (backup) — уже готово

### 3.1. `.env` — подключение к MongoDB

Файл: `backup/.env`

```env
MONGODB_URI=mongodb://127.0.0.1:27017/minecraftweb
SESSION_SECRET=webminecraft_secret_key_2024
PORT=3000
```

### 3.2. Запуск MongoDB

**Вариант A — Docker:**
```powershell
docker run -d -p 27017:27017 --name mongo mongo:7
```

**Вариант B — MongoDB установлена локально** — просто запусти службу MongoDB.

### 3.3. Установка и миграция

```powershell
cd backup
npm install
npm run migrate:mongo
npm start
```

`migrate:mongo` переносит старые `data/users.json`, `data/worlds.json`, `data/logs.json` в MongoDB.

### 3.4. API эндпоинты для чанков

Уже реализованы в `backup/routes/api.js`:

| Метод | URL | Назначение |
|-------|-----|------------|
| GET | `/api/worlds/:id` | Метаданные мира (включая **seed**) |
| GET | `/api/worlds/:id/chunks?minX=&maxX=&minZ=&maxZ=` | Загрузить чанки области |
| PUT | `/api/worlds/:id/chunks/:chunkX/:chunkZ` | Сохранить чанк |

Тело PUT-запроса:
```json
{
  "blocks": "base64-строка-262144-байт"
}
```

Заголовок авторизации обязателен:
```
Authorization: Bearer <токен из localStorage ls_token>
```

### 3.5. Создание мира с сидом

Файл: `backup/public/scripts/CreateWorld.js` — при отправке формы:

```javascript
body: JSON.stringify({
    name: WorldName,
    seed: RandomSeed ? '' : SeedInput,   // пустой seed = сервер сгенерирует сам
    worldType: WorldType
})
```

Сервер в `backup/routes/api.js` сохраняет в MongoDB:
```javascript
seed: seed || Math.floor(Math.random() * 2147483647).toString(),
```

---

## 4. Клиент TMS — уже готово

### 4.1. Загрузка сида и генерация мира

Файл: `TMS/src/core/game.js`

Порядок при `init()`:
1. Берёт `worldId` из URL: `/world?worldId=world-123`
2. Запрашивает метаданные: `GET /api/worlds/world-123`
3. Берёт `seed` из ответа (или из `localStorage ls_currentWorld` как запасной вариант)
4. Генерирует чанки: `chunk.generateTerrain(this.worldSeed)`
5. Загружает сохранённые чанки из MongoDB поверх сгенерированных

Ключевой код в `game.js`:
```javascript
const WorldMeta = await this.worldStorage.fetchWorldMeta();
this.worldSeed = this.resolveWorldSeed(WorldMeta);

for (let i = -distance; i < distance; i++)
    for (let j = -distance; j < distance; j++)
        this.world.AddChunk(this.renderer, i, j).generateTerrain(this.worldSeed);

await this.worldStorage.loadArea(this.world, -distance, distance - 1, -distance, distance - 1);
```

### 4.2. Детерминированная генерация по сиду

Файл: `TMS/src/math/math.js` — добавлены методы:
```javascript
PerlinNoise.seed(SeedValue);      // перемешивает таблицу шума по сиду
PerlinNoise.seedFloat(Seed, Salt); // псевдослучайное число 0..1 из сида
```

Файл: `TMS/src/world/chunk.js` — `generateTerrain(Seed)`:
```javascript
generateTerrain(Seed = 0)
{
    const SeedNum = parseInt(Seed, 10) || 0;
    PerlinNoise.seed(SeedNum);
    const detailScale = 0.01 + PerlinNoise.seedFloat(SeedNum, 11) * 0.025;
    const caveScale = 0.05 + PerlinNoise.seedFloat(SeedNum, 23) * 0.17;
    // ... дальше генерация блоков
}
```

**Важно:** один и тот же seed → один и тот же ландшафт у всех игроков.

### 4.3. Сохранение чанков в MongoDB

Файл: `TMS/src/network/worldStorage.js`

При изменении блока `game.js` вызывает:
```javascript
this.queueChunkSaveAtBlock(x, y, z);
```

Через 1.5 секунды чанк отправляется:
```javascript
PUT /api/worlds/${worldId}/chunks/${chunkX}/${chunkZ}
body: { blocks: chunk.exportBlocksBase64() }
```

При закрытии страницы — `flush()` сохраняет всё немедленно.

### 4.4. Экспорт/импорт блоков чанка

Файл: `TMS/src/world/chunk.js`:
```javascript
exportBlocksBase64()  // Uint32Array → base64 для отправки на сервер
loadBlocksBase64(b64) // base64 → Uint32Array при загрузке из MongoDB
```

---

## 5. P2P блоки — как работает

### 5.1. Два типа пакетов по WebRTC data channel

Файл: `TMS/src/network/multiplayer.js`

**Позиция игрока** (каждые 50 мс):
```json
{
  "type": "player",
  "name": "steve",
  "x": 10.5, "y": 55.0, "z": -3.2,
  "yaw": 1.2, "pitch": -0.1
}
```

**Изменение блока** (сразу при клике):
```json
{
  "type": "block",
  "x": 5, "y": 54, "z": 10,
  "blockId": 0,
  "seq": 42,
  "time": 1718450000000
}
```

`blockId = 0` — блок удалён. `blockId = 1` — поставлен камень.

### 5.2. Отправка блока

Файл: `TMS/src/core/game.js` — `applyLocalBlockChange()`:
```javascript
applyLocalBlockChange(x, y, z, blockId)
{
    if (blockId === 0)
        this.world.removeBlock(x, y, z);
    else
        this.world.setBlock(x, y, z, blockId);

    this.multiplayer.sendBlockChange(x, y, z, blockId);  // P2P всем пирам
    this.queueChunkSaveAtBlock(x, y, z);                  // MongoDB через 1.5с
}
```

### 5.3. Приём блока от другого игрока

`multiplayer.js` → `bindBlockHandler` → `game.js applyRemoteBlock()`:
```javascript
this.multiplayer.bindBlockHandler((x, y, z, blockId) =>
{
    this.applyRemoteBlock(x, y, z, blockId);
});

applyRemoteBlock(x, y, z, blockId)
{
    this.world.applyRemoteBlock(x, y, z, blockId);  // применить без повторной отправки
    this.queueChunkSaveAtBlock(x, y, z);             // тоже сохранить в MongoDB
}
```

Защита от дубликатов: `seenBlockKeys` хранит `peerId:seq` уже обработанных пакетов.

### 5.4. Почему не зацикливается

- Локальное изменение → `sendBlockChange` → другие получают → `applyRemoteBlock` (без `sendBlockChange`)
- Удалённое изменение только применяется и сохраняется в MongoDB

---

## 6. Сид мира — путь от формы до генерации

### Шаг 1: Пользователь создаёт мир

`backup/public/create-world.html` → `CreateWorld.js`:
```
Поле Seed: "12345"  или  галочка "Рандомный сид"
```

### Шаг 2: Сервер сохраняет в MongoDB

`POST /api/worlds` → коллекция `worlds`, поле `seed: "12345"`.

### Шаг 3: Меню сохраняет мир в localStorage

`backup/public/scripts/Menu.js` → `JoinWorld()`:
```javascript
localStorage.setItem('ls_currentWorld', JSON.stringify(World));
window.location.href = '/world?worldId=' + World.id;
```

Объект `World` содержит `{ id, name, seed, worldType, ... }`.

### Шаг 4: TMS читает seed

`TMS/src/core/game.js` → `resolveWorldSeed()`:

**Приоритет 1** — API (надёжнее):
```javascript
const WorldMeta = await this.worldStorage.fetchWorldMeta();
// GET /api/worlds/world-123 → { world: { seed: "12345", ... } }
```

**Приоритет 2** — localStorage (запасной):
```javascript
const SavedWorld = JSON.parse(localStorage.getItem('ls_currentWorld'));
return SavedWorld.seed;
```

### Шаг 5: Seed передаётся в генератор

```javascript
chunk.generateTerrain(this.worldSeed);
```

Внутри `chunk.js`:
```javascript
PerlinNoise.seed(parseInt(Seed, 10));
```

### Как передать seed вручную (для отладки)

В консоли браузера на странице `/world`:
```javascript
localStorage.setItem('ls_currentWorld', JSON.stringify({
    id: 'world-1780578529232',
    name: 'Тест',
    seed: '99999'
}));
location.reload();
```

Или добавить в URL (если нужно расширить):
```
/world?worldId=world-123&seed=99999
```
Для этого в `game.js` в `resolveWorldSeed()` можно добавить:
```javascript
const UrlSeed = new URLSearchParams(window.location.search).get('seed');
if (UrlSeed) return UrlSeed;
```

---

## 7. Проверка что всё работает

### MongoDB
```powershell
mongosh minecraftweb
db.worlds.find().pretty()
db.chunks.countDocuments()
```

### P2P блоки
1. Открой мир в двух вкладках/браузерах (разные аккаунты)
2. В одной сломай блок — во второй он должен исчезнуть **сразу**
3. В одной поставь блок — во второй появится **сразу**

### MongoDB сохранение
1. Сломай/поставь блоки
2. Подожди 2 секунды
3. Перезагрузи страницу — блоки на месте
4. `db.chunks.find({ worldId: "world-..." })` — должны появиться записи

### Seed
1. Создай два мира с одинаковым сидом "42"
2. Зайди в оба — ландшафт должен совпадать (до изменений блоков)

---

## 8. Если что-то сломалось

| Проблема | Решение |
|----------|---------|
| `MongoDB connection refused` | Запусти MongoDB: `docker start mongo` |
| Чанки не сохраняются | Проверь `ls_token` в localStorage, залогинься заново |
| P2P блоки не видны | Проверь что socket.io загружен, в консоли нет ошибок WebRTC |
| Разный ландшафт у игроков | Убедись что seed одинаковый в `db.worlds` |
| 401 на /api/worlds | Токен истёк — перелогинься |

---

## Файлы которые были изменены

| Файл | Что сделано |
|------|-------------|
| `TMS/src/network/multiplayer.js` | P2P пакеты `type: block`, `sendBlockChange`, `bindBlockHandler` |
| `TMS/src/core/game.js` | `applyLocalBlockChange`, `applyRemoteBlock`, загрузка seed |
| `TMS/src/network/worldStorage.js` | `fetchWorldMeta()` для получения seed с сервера |
| `TMS/src/world/world.js` | `applyRemoteBlock`, исправлены координаты блоков |
| `TMS/src/world/chunk.js` | `generateTerrain(Seed)`, base64 экспорт/импорт |
| `TMS/src/math/math.js` | `PerlinNoise.seed()`, `seedFloat()` |
| `backup/storage.js` | MongoDB вместо JSON файлов |
| `backup/routes/api.js` | API чанков и миров |

---

## Краткая шпаргалка команд

```powershell
# Запуск всего
cd backup
npm start

# Миграция данных (один раз)
npm run migrate:mongo

# Просмотр MongoDB
mongosh minecraftweb

# Админ
node tools/set-user-admin.js steve true
```
