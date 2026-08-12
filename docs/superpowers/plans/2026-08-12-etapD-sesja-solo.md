# Этап D: Sesja solo — занятие одного на 40 минут — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Страница «Sesja», которая собирает занятие из уже существующего контента и ведёт по нему с таймером: слова → грамматика → квиз → письмо. Прогресс сессий и стрик копятся в облаке.

**Architecture:** Клиентская страница `/sesja/`, весь контент отдаётся статикой при сборке (список лекций, колоды слов, квизы), выбор блоков делает чистая функция `plan-sesji.js` (тестируемая в node). Состояние Лейтнера переезжает из localStorage в облако **с сохранением локального фолбэка** — не залогинен или нет сети, учишься дальше, при следующем входе состояния сливаются по правилу «больше повторений выигрывает». Сессия пишется в `users/{uid}/sesje/{autoId}`, стрик считается из дат сессий на клиенте.

**Tech Stack:** без новых зависимостей.

**Контекст:** repo `D:\Program\Claude Programs\polish-hub`. UI/комментарии по-польски, тесты plain-node (`ok/zle`, exit code). Существующее: `flashcards.js` (Лейтнер: `wczytajStan/zapiszStan/oceń/zbudujKolejke/statystyki`, ключ `pk_slowka_v1`, коробки 1–5, интервалы `[0,1,3,7,21]`), `cwiczenia.js` + `cwiczenia-logika.js` (4 типа упражнений в лекциях), `chmura.js` (`zaloguj/obserwujOsobe/zapiszWynik/mojProfil/pobierzProfile/gotowyUzytkownik/zapiszDoZeszytu/pobierzZeszyt`), `quiz-engine.js`.

---

## Task D1: Лейтнер в облако (TDD логика слияния)

**Files:** Create `src/scripts/leitner-sync.js`, `test/leitner-sync.test.mjs`; Modify `src/scripts/chmura.js`, `firestore.rules`, `package.json`.

- Чистая функция `polacz(lokalny, zdalny)` → объединённое состояние: для каждого id берётся запись с **бо́льшим числом повторений** (`powtorki`), при равенстве — с более поздним `termin`. Слова, которых нет с одной стороны, попадают целиком. Функция чистая, без Firebase.
- В `flashcards.js` добавить счётчик `powtorki` (инкремент в `oceń`) — существующие состояния без него читаются как `0`, поведение старых тестов не меняется (проверить `npm test`).
- `chmura.js`: `zapiszLeitner(stan)` / `pobierzLeitner()` в документ `users/{uid}` (поле `leitner`, merge). Правила: то же, что для профиля (свой документ).
- Тесты: пустой + непустой; конфликт по `powtorki`; конфликт при равенстве; идемпотентность `polacz(a, polacz(a,b)) === polacz(a,b)`.

## Task D2: `plan-sesji.js` — сборка занятия (TDD)

**Files:** Create `src/scripts/plan-sesji.js`, `test/plan-sesji.test.mjs`; Modify `package.json`.

```js
// Blok sesji: { rodzaj: 'slowka'|'gramatyka'|'quiz'|'pisanie', minuty, tytul, dane }
export function zbudujSesje({ slowaDoPowtorki, lekcje, ostatnieSesje, dzien }) // -> { bloki, minutyRazem }
```
Правила сборки (все — чистая логика, без DOM):
- **slowka** — всегда первый блок, 5 минут, берёт очередь Лейтнера (макс. 20 слов); если повторять нечего — блок пропускается, а его время отдаётся грамматике.
- **gramatyka** — 12 минут: лекция выбирается по ротации от `ostatnieSesje` (последняя пройденная + 1, по кругу), берутся её блоки `cwiczenie`.
- **quiz** — 13 минут: квиз той же лекции.
- **pisanie** — 10 минут: блок `pisanie` из той же лекции; если его нет — из ближайшей предыдущей лекции, где он есть.
- Сумма ≈40 минут; функция возвращает `minutyRazem` для показа.
- Тесты: нет слов → 3 блока и время перераспределено; ротация лекций (три вызова подряд дают разные лекции); лекция без `pisanie` → берётся предыдущая; пустой список лекций → пустой план, без исключения.

## Task D3: Страница `/sesja/`

**Files:** Create `src/pages/sesja.astro`; Modify `src/layouts/Base.astro` (пункт меню «Sesja»).

- Frontmatter отдаёт в клиент JSON-остров: все лекции (id, tytul, emoji, numer, наличие `pisanie`-блока, id квиза) и все колоды слов.
- Экран старта: «Dzisiejsza sesja ≈40 min», список блоков с минутами, кнопка «Zaczynamy».
- Прохождение: блоки по очереди, вверху мягкий таймер блока (показывает, не обрывает) и полоса прогресса «блок 2 / 4».
- Блок `slowka` — переиспользовать существующий движок фишек (`flashcards.js` + разметка со страницы `slowka/[talia].astro`; вынести общий рендер, если проще — импортировать функцию, а не копировать).
- Блок `gramatyka` — рендерить `cwiczenie`-блоки лекции движком `cwiczenia.js` (нужен экспорт функции «построй из данных», сейчас модуль сам сканирует DOM — добавить экспорт `zbudujZDanych(dane, kontener)` и оставить автоскан для лекций).
- Блок `quiz` — переиспользовать `quiz-engine.js` (тот же приём: экспортировать запуск, оставить автостарт).
- Блок `pisanie` — textarea + сохранение в зешит (уже есть).
- Финал: «Sesja skończona», сводка (сколько слов, % за квиз), запись в облако.

## Task D4: Запись сессий и стрик

**Files:** Modify `src/scripts/chmura.js`, `firestore.rules`, `src/pages/profil.astro`, `src/pages/index.astro`.

- `zapiszSesje({ data, bloki, wynikQuizu, slowaPowtorzone })` → `users/{uid}/sesje/{autoId}`; правила — как у `zeszyt` (только автор).
- `pobierzSesje(ile = 60)`.
- Чистая функция `policzStreak(daty, dzis)` в `plan-sesji.js` + тесты: подряд идущие дни; разрыв обнуляет; сегодня ещё не занимался — стрик вчерашний, не сгорел; две сессии в один день считаются за один.
- Профиль: «Seria: N dni 🔥», последние сессии.
- Главная: кнопка «Dzisiejsza sesja» вверху, если сегодня ещё не занимался.

## Task D5: E2E (контролёр)

Прогон сессии целиком на localhost, проверка записи в Firestore, стрик после второй сессии, поведение без входа (сессия работает, прогресс не пишется — честное сообщение).

## Осознанные ограничения
- Чтение и аудирование в сессии появятся в этапах E/F — пока блоки берутся из существующего контента (слова, упражнения, квизы, письмо).
- Стрик считается на клиенте по датам сессий: часовой пояс — локальный, честно и просто; серверная правда не нужна для трёх друзей.
