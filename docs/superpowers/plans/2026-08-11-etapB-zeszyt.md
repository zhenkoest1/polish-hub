# Этап B: Zeszyt (mini-pisanie в облако) + retrofit лекций 11–13 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Свежий субагент на задачу + спек-ревью + качество-ревью.

**Goal:** Письменные задания перестают быть «поговорили и забыли»: пишешь в поле → сохраняется в облако → на встрече открываешь «Mój zeszyt» и читаешь. Лекции 11–13 получают интерактивные ćwiczenia.

**Architecture:** Новый тип упражнения `pisanie` в том же движке `cwiczenia.js`: textarea на каждый пункт + кнопка «Zapisz w zeszycie» → `zapiszDoZeszytu()` в `chmura.js` → `users/{uid}/zeszyt/{autoId}`. Автосохранение черновика в localStorage (не потерять текст при перезагрузке до нажатия «Zapisz»). Раздел «Mój zeszyt» на странице профиля читает записи. Firebase грузится лениво — только когда юзер реально жмёт «Zapisz» (динамический импорт, как в quiz-engine).

**Tech Stack:** без новых зависимостей.

**Контекст для исполнителя:** repo `D:\Program\Claude Programs\polish-hub`. Рабочее дерево ЧИСТОЕ (всё закоммичено) — коммитить только свои файлы. UI и комментарии по-польски. Тесты plain-node (`ok/zle`, exit code), запуск `npm test`. Существующее: `cwiczenia-logika.js` (parsujCwiczenie/sprawdzWybor/sprawdzWpisz), `cwiczenia.js` (DOM-движок, находит `pre[data-language="plaintext"] > code` начинающиеся с `{` и содержащие `"typ"`), `chmura.js` (zaloguj/wyloguj/obserwujOsobe/zapiszWynik/mojProfil/pobierzProfile/gotowyUzytkownik), `profil.astro` (вход + таблица лучших результатов).

---

## Task B1: Схема `pisanie` в логике (TDD)

**Files:** Modify `src/scripts/cwiczenia-logika.js`, `test/cwiczenia.test.mjs`.

Контракт нового типа (дописать в комментарий модуля):
```js
// { "typ": "pisanie", "tytul": "...", "instrukcja": "...",
//   "zdania": [ { "przed": "1. Co zacząłem i nie skończyłem?", "po": "", "czemu": "ndk, czas przeszły" } ] }
```
`przed` — формулировка задания, `po` — обычно пустая, `czemu` — грамматическая подсказка (показывается серым под полем).

1. Добавить `'pisanie'` в `TYPY`. Для `pisanie` НЕ требуются ни `opcje/dobra`, ни `odpowiedz` (проверять нечего — это свободный текст); `przed`/`po` — как обычно строки.
2. Тесты: валидный блок `pisanie` → ok:true; `pisanie` без `zdania` → ok:false; `pisanie` с `przed: 42` → ok:false; существующие тесты `wybor`/`wpisz` не сломаны.
3. `npm test` зелёный.
4. Commit: `feat: typ cwiczenia "pisanie" w schemacie (TDD)` — 2 файла.

## Task B2: `zapiszDoZeszytu` + `pobierzZeszyt` в chmura.js

**Files:** Modify `src/scripts/chmura.js`; Modify `firestore.rules`.

1. Импортировать дополнительно `query`, `orderBy`, `limit` из `firebase/firestore` (к существующим).
2. Добавить экспорты (стиль и защиты — как в `zapiszWynik`: ждать сессию через `auth.currentUser ?? await gotowyUzytkownik()`):

```js
// Zapis pracy pisemnej. Zwraca true gdy zapisano, false gdy nikt nie zalogowany.
export async function zapiszDoZeszytu({ lekcja, zadanie, wpisy }) {
  const user = auth.currentUser ?? await gotowyUzytkownik();
  if (!user) return false;
  await addDoc(collection(db, 'users', user.uid, 'zeszyt'), {
    lekcja, zadanie, wpisy, ts: serverTimestamp(),
  });
  return true;
}

// Ostatnie prace pisemne zalogowanej osoby (domyslnie 30).
export async function pobierzZeszyt(ile = 30) {
  const user = auth.currentUser ?? await gotowyUzytkownik();
  if (!user) return [];
  const q = query(collection(db, 'users', user.uid, 'zeszyt'), orderBy('ts', 'desc'), limit(ile));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
```
`wpisy` — массив строк (по одной на пункт задания).

3. `firestore.rules`: внутри `match /users/{uid}` добавить подколлекцию рядом с `attempts`:
```
      // Zeszyt: prace pisemne czyta i pisze TYLKO autor —
      // cudzych wypracowan nie oglada nikt (inaczej niz wyniki quizow).
      match /zeszyt/{wpisId} {
        allow read, create: if jestSwoj() && request.auth.uid == uid;
        allow update, delete: if false;
      }
```
(Правила в консоли публикует контролёр — субагент только правит файл.)

4. `npm run build` — Complete!.
5. Commit: `feat: zeszyt w chmurze — zapis i odczyt prac pisemnych` — 2 файла.

## Task B3: Рендер `pisanie` в движке + черновики

**Files:** Modify `src/scripts/cwiczenia.js`, `src/styles/quiz.css`.

В `cwiczenia.js`:
- В `zbuduj`: для `typ === 'pisanie'` вместо кнопок/инпута рендерить `przed` как текст задания и `<textarea class="cw-pisanie" data-i="i" rows="3">`, под ним `czemu` серым (`<span class="cw-podpowiedz">`).
- Кнопка внизу для `pisanie` — **«💾 Zapisz w zeszycie»** (класс `.cw-zapisz`, не `.cw-sprawdz`), под ней `<p class="cw-status">`.
- **Черновик:** ключ `pk_szkic_<lekcjaId>_<tytulSlug>`; на `input` в textarea — сохранять массив значений в localStorage (обёрнуто в try/catch — приватный режим); при инициализации — восстанавливать. `lekcjaId` брать из `document.body.dataset.lekcja` (см. ниже) или из `location.pathname`.
- По клику «Zapisz»: если все поля пустые — трясти и выйти; иначе статус «⏳ zapisuję…», динамический `import('./chmura.js')` → `zapiszDoZeszytu({lekcja, zadanie: dane.tytul, wpisy})`; гонка 4 с как в quiz-engine (с `.catch(()=>{})` на внутреннем промисе); результаты: `true` → «✓ Zapisano w zeszycie» + очистить черновик; `'timeout'` → «✓ Zapisze się, gdy wróci internet»; `false` → «<a href="${base}/profil/">Zaloguj się</a>, żeby zapisywać w zeszycie»; ошибка → «⚠️ Nie udało się zapisać».
- Ничего из существующего поведения `wybor`/`wpisz` не менять.

В `quiz.css` дописать: `.cw-pisanie` (ширина 100%, шрифт inherit, фон `--bg-deep`, рамка `--line`, radius 8px, padding 8px 10px; focus — рамка `--blekit`), `.cw-podpowiedz` (0.82rem, `--text-dim`), `.cw-status` (как `.q-save-status`), `.cw-zdanie` в режиме pisanie — вертикальный ритм.

Commit: `feat: cwiczenie "pisanie" — textarea, szkic w localStorage, zapis do zeszytu`.

## Task B4: `lekcja` в dataset страницы

**Files:** Modify `src/pages/lekcje/[id].astro`.

Движку нужно знать, из какой лекции запись. Добавить на корневой `<article>` (или на элемент, который точно есть) атрибут `data-lekcja={lekcja.id}` и в `cwiczenia.js` читать `document.querySelector('[data-lekcja]')?.dataset.lekcja ?? location.pathname`. (Если проще — положить в `<body>` нельзя, Base.astro общий; используем article.)

Commit: `feat: strona lekcji podaje swoje id silnikowi cwiczen`.

## Task B5: «Mój zeszyt» в профиле

**Files:** Modify `src/pages/profil.astro`.

- Под таблицей лучших результатов — секция `<h2>Mój zeszyt</h2>` + `<div id="p-zeszyt">`.
- В клиентском скрипте (в том же `obserwujOsobe`-колбэке, после результатов): `pobierzZeszyt()` в try/catch; пусто → «Jeszcze nic nie napisałeś — ćwiczenia pisemne są w lekcjach.»; иначе список карточек: заголовок `zadanie` + лекция + дата (`ts?.toDate?.()` → `toLocaleDateString('pl-PL')`, если `ts` ещё null из-за serverTimestamp — писать «przed chwilą»), и `wpisy` как `<ol>` с `esc()` по каждому пункту.
- Стили `.zeszyt-*` — в **глобальный** style-блок profil.astro (innerHTML-контент, скоуп его не видит — грабли уже проходили).

Commit: `feat: Moj zeszyt w profilu — lista prac pisemnych`.

## Task B6: Retrofit лекций 11–13

**Files:** Modify `src/content/lekcje/11-podroze-w-czasie.md`, `12-grzecznosc.md`, `13-madrosc-tlumu.md`.

Для КАЖДОЙ лекции:
1. Прочитать секцию `## 🗣️ Na spotkaniu` целиком.
2. Задания, где есть **однозначный правильный ответ** (выбрать форму, поставить в падеж, дать пару) → блок `wybor` или `wpisz`. Ответы выводить из грамматики самой лекции (её раздел `## 📐`), при сомнении — оставить задание устным, НЕ выдумывать.
3. Задание типа **Mini-pisanie / напиши предложения** → блок `pisanie` (пункты из оригинального задания как `przed`, грамматическая подсказка в `czemu`).
4. Устные задания (дискуссия, «przeczytaj na głos», «wytłumacz koledze») — не трогать.
5. Не менять: тексты лекций, разделы 📐/📖/📝, квизы.

Проверка: `npm test` (валидатор проверит все новые блоки; счётчик `cwiczeniaRazem` вырастет) + `npm run build`.

Commit: `feat: lekcje 11-13 interaktywne — cwiczenia i mini-pisanie` — 3 файла.

## Task B7: E2E (контролёр)

Прод/дев: лекция 10 (регресс: wybor/wpisz работают), лекция 11 — написать в pisanie → перезагрузить (черновик на месте) → Zapisz → профиль → «Mój zeszyt» показывает запись. Опубликовать правила в консоли Firebase. Обновить Hub-ноду.

## Self-review плана
- Новый тип `pisanie` не ломает существующие: в логике только добавление в TYPY + ветка без обязательных полей ответа; в движке — отдельная ветка рендера и отдельная кнопка.
- Имена сверены между задачами: `zapiszDoZeszytu({lekcja, zadanie, wpisy})` / `pobierzZeszyt(ile)` — B2 определяет, B3 и B5 потребляют; `data-lekcja` — B4 ставит, B3 читает.
- Приватность: правила `zeszyt` строже, чем у результатов — сочинения видит только автор (осознанное решение, записано в правилах комментарием).
