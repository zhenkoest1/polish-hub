# Этап A: Silnik ćwiczeń + retrofit лекции 10 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Каждая задача — свежий субагент + спек-ревью + качество-ревью.

**Goal:** Задания в лекциях становятся интерактивными: выбор варианта кнопками в предложении, впиши-в-строку, кнопка Sprawdź на раунд с показом правильных ответов. Лекция 10 переведена на новый формат.

**Architecture:** Упражнения размечаются в markdown лекции fenced-блоком ```` ```cwiczenie ```` с JSON. Astro/Shiki рендерит неизвестный язык как `<pre data-language="cwiczenie">` — клиентский скрипт находит эти блоки, парсит JSON и заменяет на интерактивный DOM. Битый JSON НЕ роняет ни билд, ни страницу: движок оставляет блок как есть (мягкая деградация — урок июля!), а `npm test` шумит. Чистая логика проверки отделена от DOM и покрыта node-тестами.

**Tech Stack:** тот же (Astro 5, ноль зависимостей). Общие текст-утилиты выносятся из quiz-engine в `tekst.js`.

**Контекст для исполнителя:** repo `D:\Program\Claude Programs\polish-hub`. UI по-польски, комментарии по-польски. Тесты plain-node (ok/zle, exit code), запуск `npm test`. В working tree есть чужие несохранённые правки в `src/content/` и `src/data/` — НЕ коммитить, НЕ стэшить, НЕ трогать (кроме файла лекции 10, который правится по задаче A4 — его коммитить ЦЕЛИКОМ, включая существующие незакоммиченные правки: они легитимны, проверено).

---

## Task A1: `tekst.js` — общие текст-утилиты (TDD, рефакторинг)

**Files:** Create `src/scripts/tekst.js`, `test/tekst.test.mjs`; Modify `src/scripts/quiz-engine.js` (строки 30–46), `package.json` (test-строка).

1. Тест `test/tekst.test.mjs` (стиль ok/zle): `stripDiacritics('ąćęłńóśżź')==='acelnoszz'`, `norm('  Ala  MA kota ')==='ala ma kota'`, идемпотентность, пустая строка.
2. `src/scripts/tekst.js` — **выносится дословно** из quiz-engine.js: функции `stripDiacritics(s)` и `norm(s)` с `export`.
3. В quiz-engine.js удалить локальные определения, добавить `import { stripDiacritics, norm } from './tekst.js';`.
4. `npm test` + `npm run build` зелёные (поведение движка не меняется — функции те же байты).
5. Commit: `refactor: tekst.js — wspolne stripDiacritics/norm (TDD)` — только 4 файла.

## Task A2: `cwiczenia-logika.js` — чистая логика (TDD)

**Files:** Create `src/scripts/cwiczenia-logika.js`, `test/cwiczenia.test.mjs`; Modify `package.json`.

Формат данных (контракт, зафиксировать в комментарии модуля):

```js
// Blok ```cwiczenie w markdown lekcji — JSON:
// { "typ": "wybor", "tytul": "...", "instrukcja": "...",
//   "zdania": [ { "przed": "Wczoraj cały wieczór ", "opcje": ["czytać", "przeczytać"],
//                 "dobra": 0, "po": " tę książkę.", "czemu": "cały wieczór = proces → ndk" } ] }
// { "typ": "wpisz", "tytul": "...", "instrukcja": "...",
//   "zdania": [ { "przed": "pisać → ", "odpowiedz": ["napisać"], "po": "", "czemu": "..." } ] }
```

Экспорты:
```js
export function parsujCwiczenie(tekstJson) // -> {ok:true, dane} | {ok:false, blad}  — JSON.parse + walidacja schematu
export function sprawdzWybor(zdanie, wybranyIndex) // -> boolean
export function sprawdzWpisz(zdanie, wpisane) // -> 'dobrze' | 'prawie' | 'zle'  — norm + stripDiacritics, odpowiedz to tablica
```

Валидация `parsujCwiczenie`: typ ∈ {wybor, wpisz}; zdania непустой массив; для wybor: opcje ≥2 строк, dobra — валидный индекс; для wpisz: odpowiedz — непустой массив непустых строк; przed/po — строки (po может быть пустой). Тесты: валидные оба типа, битый JSON, неизвестный typ, dobra вне диапазона, wpisz с диакритикой → 'prawie', массив ответов, регистр/пробелы → norm.

Commit: `feat: logika cwiczen — parsowanie i sprawdzanie (TDD)`.

## Task A3: `cwiczenia.js` — DOM-движок + стили + подключение

**Files:** Create `src/scripts/cwiczenia.js`; Modify `src/styles/quiz.css` (в конец), `src/pages/lekcje/[id].astro` (script-блок).

Движок (полный код в задаче для субагента, здесь — поведение):
- Найти все `pre[data-language="cwiczenie"]` (fallback: `pre.astro-code` с `code` начинающимся с `{"typ"`); `parsujCwiczenie(textContent)`; при `ok:false` — `console.warn` и блок остаётся как есть.
- Рендер: рамка в стиле quiz-zone; tytul + instrukcja; список zdań.
  - **wybor**: przed + кнопки opcji (toggle выбора) + po
  - **wpisz**: przed + `<input>` + po
- Внизу кнопка **Sprawdź** (disabled, пока не всё отвечено для wybor; для wpisz — активна всегда, пустые поля трясутся как в квизах). По клику: каждое zdanie красится ✓/✗ (у wpisz «prawie» — янтарный, как в квизах), под неверными — правильный ответ + `czemu`; кнопка превращается в «🔁 Jeszcze raz» (сброс).
- Никакого Firestore в этапе A (запись прогресса ćwiczeń — этап B вместе с Zeszytem) — YAGNI.
- В `[id].astro` в `<script>` рядом с quiz-engine добавить `import '../../scripts/cwiczenia.js';`.
- Стили: `.cw-*` классы, **добавить в quiz.css** (он глобальный — грабли Astro-скоупинга с innerHTML уже пройдены на профиле).

Commit: `feat: silnik cwiczen — wybor i wpisz z przyciskiem Sprawdz`.

## Task A4: Retrofit лекции 10 + валидатор

**Files:** Modify `src/content/lekcje/10-zeigarnik.md`, `test/tresc.test.mjs`.

1. **Rozgrzewka**, пункты 1–2 → два блока `wpisz`: «podaj parę dokonaną: pisać → ___» (6 глаголов) и «podaj parę niedokonaną: dać → ___» (6 глаголов). Пункт 3 оставить устным.
2. **Runda 1 — proces czy wynik?** → блок `wybor` из 9 предложений (A1–C3), правильный аспект по контекстному маркеру, `czemu` — одно предложение с маркером («cały wieczór = proces → ndk»). Проверить каждый ответ по грамматике аспектов (маркеры: cały wieczór/codziennie/zwykle/przez dwa lata/godzinami → ndk; w godzinę/nagle/wreszcie/od razu → dk).
3. Runda 2, Runda 3, Pytania do tekstu, Dyskusja, Mini-pisanie — **не трогать** (устные / этап B).
4. Валидатор `tresc.test.mjs`: для каждого md-файла лекций извлечь ```cwiczenie-блоки (regex по fenced-блокам), прогнать `parsujCwiczenie` — битый блок = FAIL с именем лекции и номером блока. Импортировать `parsujCwiczenie` из `../src/scripts/cwiczenia-logika.js`.
5. `npm test` (валидатор теперь проверяет и новые блоки) + `npm run build`.
6. Commit: файл лекции 10 (целиком, вместе с ранее висевшими правками) + tresc.test.mjs: `feat: lekcja 10 interaktywna — rozgrzewka i runda 1 + walidator cwiczen`.

## Task A5: E2E (контролёр, в браузере)

Dev-сервер → лекция 10 → Rozgrzewka: впиши пары (с ошибкой диакритики → «prawie»), Sprawdź; Runda 1: выбрать всё → Sprawdź → ✓/✗ + czemu; Jeszcze raz сбрасывает; битый JSON руками в devtools не роняет страницу. Обновить Hub-ноду, напомнить про push.

## Self-review плана
- Формат JSON один и тот же в A2 (контракт), A3 (рендер), A4 (контент) — имена полей сверены: typ/tytul/instrukcja/zdania/przed/po/opcje/dobra/odpowiedz/czemu.
- Мягкая деградация битого блока — в A3 (страница) и A4 (валидатор шумит) — двойная защита, как с квизами.
- tekst.js: quiz-engine импортирует те же функции — поведение квизов не меняется, тесты это ловят.
