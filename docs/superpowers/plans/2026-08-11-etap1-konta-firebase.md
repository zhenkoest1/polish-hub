# Этап 1: Аккаунты (аватар+PIN) и сохранение результатов — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Прогресс квизов перестаёт теряться: вход по аватару+PIN (Firebase Auth), результаты и лучшие счёты пишутся в Firestore, на главной — дашборд «кто что прошёл».

**Architecture:** Статический Astro-сайт остаётся статическим; вся динамика — клиентские скрипты. Firebase Auth email+password под капотом: служебный email `slug@polskiklub.local`, пароль детерминированно из PIN. Чистая логика (`konto.js`, `wyniki.js`) отделена от Firebase-обвязки (`chmura.js`) и покрыта node-тестами без Firebase. Лучшие результаты — map в документе `users/{uid}` (1 чтение на человека), история попыток — подколлекция `attempts`.

**Tech Stack:** Astro 5 (уже есть), `firebase` npm (Auth + Firestore, modular SDK), plain-node тесты как в `test/srs.test.mjs`.

**Контекст для исполнителя с нуля:**
- Репо: `D:\Program\Claude Programs\polish-hub`, деплой — GitHub Pages, base `/polish-hub`. `git push` делает Женя руками.
- UI-строки — по-польски, комментарии в коде — по-польски (так во всём репо).
- Квиз-движок: `src/scripts/quiz-engine.js`, данные квиза кладутся в `<script type="application/json" id="quiz-data">` двумя страницами: `src/pages/quizy/[id].astro` и `src/pages/mix.astro`.
- Тесты: plain node, счётчик `ok/zle`, `process.exit(zle ? 1 : 0)`, запуск `npm test`.
- В репо могут висеть чужие незакоммиченные правки `src/content/lekcje/1*.md` — НЕ добавлять их в свои коммиты, коммитить только перечисленные в задаче файлы.

---

## Task 0: Firebase-проект (ручная задача, вместе с Женей)

**Files:** нет (консоль Firebase в браузере)

- [ ] **Step 1: Создать проект.** https://console.firebase.google.com → «Add project» → имя `polski-klub` → Google Analytics **выключить** → Create.
- [ ] **Step 2: Включить вход по паролю.** Build → Authentication → Get started → Sign-in method → Email/Password → **Enable** (только верхний тумблер, Email link не нужен) → Save.
- [ ] **Step 3: Создать Firestore.** Build → Firestore Database → Create database → location `eur3 (europe-west)` → **Start in production mode** → Create.
- [ ] **Step 4: Зарегистрировать веб-апп.** Project settings (шестерёнка) → «Your apps» → иконка `</>` → nickname `polski-hub` → Register (Hosting не включать). Скопировать объект `firebaseConfig` — он нужен в Task 1.
- [ ] **Step 5: Записать config во временный файл** `D:\Program\Claude Programs\polish-hub\firebase-config.txt` (Task 1 заберёт его оттуда; файл потом удалим — хотя ключи публичны by design, мусор в корне не нужен).

## Task 1: Зависимость и конфиг

**Files:**
- Create: `src/scripts/firebase-config.js`
- Modify: `package.json` (запись в dependencies произойдёт сама через npm)

- [ ] **Step 1: Установить SDK**

Run: `cd "D:/Program/Claude Programs/polish-hub" && npm install firebase`
Expected: `added N packages`, в `package.json` появился `"firebase": "^12.x"` (или ^11 — любая текущая мажорка ок).

- [ ] **Step 2: Создать `src/scripts/firebase-config.js`** — вставить реальные значения из `firebase-config.txt` (Task 0, Step 5):

```js
// Konfiguracja Firebase. Te klucze są PUBLICZNE by design —
// bezpieczeństwo trzymają Security Rules po stronie serwera, nie sekrety.
export const firebaseConfig = {
  apiKey: 'WKLEJ_Z_KONSOLI',
  authDomain: 'polski-klub.firebaseapp.com',
  projectId: 'polski-klub',
  storageBucket: 'polski-klub.firebasestorage.app',
  messagingSenderId: 'WKLEJ_Z_KONSOLI',
  appId: 'WKLEJ_Z_KONSOLI',
};
```

Если `projectId` в консоли получил суффикс (например `polski-klub-3f2a1`) — вставить как есть из консоли, не «поправлять».

- [ ] **Step 3: Проверить, что сайт собирается**

Run: `npm run build`
Expected: `Complete!` без ошибок (конфиг ещё никем не импортируется — это нормально).

- [ ] **Step 4: Удалить `firebase-config.txt` и закоммитить**

```bash
rm -f firebase-config.txt
git add package.json package-lock.json src/scripts/firebase-config.js
git commit -m "feat: firebase SDK + publiczna konfiguracja projektu"
```

## Task 2: Чистая логика аккаунтов — `konto.js` (TDD)

**Files:**
- Create: `src/scripts/konto.js`
- Create: `test/konto.test.mjs`
- Modify: `package.json` (строка `"test"`)

- [ ] **Step 1: Написать падающий тест** `test/konto.test.mjs`:

```js
import { OSOBY, emailOsoby, pinNaHaslo, poprawnyPin, osobaZeSluga } from '../src/scripts/konto.js';

let ok = 0, zle = 0;
const t = (nazwa, war) => { war ? ok++ : (zle++, console.log('  FAIL:', nazwa)); };

// trzy osoby, unikalne slugi
t('trzy osoby', OSOBY.length === 3);
t('slugi unikalne', new Set(OSOBY.map((o) => o.slug)).size === 3);
t('kazda osoba ma emoji i imie', OSOBY.every((o) => o.slug && o.name && o.emoji));

// email deterministyczny i poprawny skladniowo
t('email format', emailOsoby('zenia') === 'zenia@polskiklub.local');
t('email rozny dla osob', emailOsoby('oleg') !== emailOsoby('lena'));

// haslo: deterministyczne, >= 6 znakow (wymog Firebase), zalezne od sluga i pinu
t('haslo deterministyczne', pinNaHaslo('zenia', '1234') === pinNaHaslo('zenia', '1234'));
t('haslo >= 6 znakow', pinNaHaslo('oleg', '0000').length >= 6);
t('haslo zalezy od pinu', pinNaHaslo('zenia', '1234') !== pinNaHaslo('zenia', '4321'));
t('haslo zalezy od sluga', pinNaHaslo('zenia', '1234') !== pinNaHaslo('oleg', '1234'));

// walidacja PIN: dokladnie 4 cyfry
t('pin 4 cyfry ok', poprawnyPin('0421'));
t('pin litery zle', !poprawnyPin('12ab'));
t('pin 3 cyfry zle', !poprawnyPin('123'));
t('pin 5 cyfr zle', !poprawnyPin('12345'));
t('pin pusty zle', !poprawnyPin(''));

// wyszukiwanie osoby
t('osoba po slugu', osobaZeSluga('lena').name === 'Lena');
t('nieznany slug -> undefined', osobaZeSluga('obcy') === undefined);

console.log(`\n${ok} przeszlo, ${zle} nie przeszlo`);
process.exit(zle ? 1 : 0);
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `node test/konto.test.mjs`
Expected: FAIL — `Cannot find module ... konto.js`

- [ ] **Step 3: Написать `src/scripts/konto.js`**

```js
// Konta trzech osob. Zadnych sekretow: PIN zna tylko wlasciciel,
// a serwer (Firebase Auth) sprawdza haslo wyprowadzone z PIN-u.
export const OSOBY = [
  { slug: 'oleg', name: 'Oleg', emoji: '🦅' },
  { slug: 'lena', name: 'Lena', emoji: '🌸' },
  { slug: 'zenia', name: 'Żenia', emoji: '🐺' },
];

export function osobaZeSluga(slug) {
  return OSOBY.find((o) => o.slug === slug);
}

// Email jest sluzbowy — nikt na niego nie pisze, to tylko identyfikator w Auth.
export function emailOsoby(slug) {
  return `${slug}@polskiklub.local`;
}

// Firebase wymaga hasla >= 6 znakow; PIN ma 4 — doklejamy stale czesci.
// To NIE jest kryptografia (kod jest publiczny) — ochrona w tym, ze haslo
// sprawdza serwer, wiec bez PIN-u nie zapiszesz sie jako inna osoba.
export function pinNaHaslo(slug, pin) {
  return `PK-${slug}-${pin}-gora`;
}

export function poprawnyPin(pin) {
  return /^\d{4}$/.test(pin);
}
```

- [ ] **Step 4: Прогнать тест**

Run: `node test/konto.test.mjs`
Expected: `16 przeszlo, 0 nie przeszlo`, exit 0

- [ ] **Step 5: Подключить в `npm test`** — в `package.json` заменить строку

```json
"test": "node test/srs.test.mjs && node test/tresc.test.mjs"
```
на
```json
"test": "node test/srs.test.mjs && node test/tresc.test.mjs && node test/konto.test.mjs && node test/wyniki.test.mjs"
```
(`wyniki.test.mjs` появится в Task 3 — до того `npm test` будет падать на последнем шаге; это ок, задачи 2 и 3 коммитятся подряд.)

- [ ] **Step 6: Commit**

```bash
git add src/scripts/konto.js test/konto.test.mjs package.json
git commit -m "feat: konta osob — slug, email sluzbowy, haslo z PIN-u (TDD)"
```

## Task 3: Чистая логика результатов — `wyniki.js` (TDD)

**Files:**
- Create: `src/scripts/wyniki.js`
- Create: `test/wyniki.test.mjs`

- [ ] **Step 1: Написать падающий тест** `test/wyniki.test.mjs`:

```js
import { procent, lepszyWynik } from '../src/scripts/wyniki.js';

let ok = 0, zle = 0;
const t = (nazwa, war) => { war ? ok++ : (zle++, console.log('  FAIL:', nazwa)); };

// procent — jak w quiz-engine
t('procent zwykly', procent(7, 10) === 70);
t('procent zaokragla', procent(2, 3) === 67);
t('procent max=0 -> 0', procent(0, 0) === 0);

// lepszyWynik: wyzszy pct wygrywa, remis zostawia stary (starszy rekord)
const stary = { pct: 70, got: 7, max: 10, ts: 1000 };
const lepszy = { pct: 90, got: 9, max: 10, ts: 2000 };
const gorszy = { pct: 50, got: 5, max: 10, ts: 3000 };
const remis = { pct: 70, got: 14, max: 20, ts: 4000 };
t('brak starego -> nowy', lepszyWynik(undefined, stary) === stary);
t('null starego -> nowy', lepszyWynik(null, stary) === stary);
t('lepszy zastepuje', lepszyWynik(stary, lepszy) === lepszy);
t('gorszy nie zastepuje', lepszyWynik(stary, gorszy) === stary);
t('remis zostawia stary', lepszyWynik(stary, remis) === stary);

console.log(`\n${ok} przeszlo, ${zle} nie przeszlo`);
process.exit(zle ? 1 : 0);
```

- [ ] **Step 2: Убедиться, что падает**

Run: `node test/wyniki.test.mjs`
Expected: FAIL — `Cannot find module ... wyniki.js`

- [ ] **Step 3: Написать `src/scripts/wyniki.js`**

```js
// Czysta logika wynikow — bez Firebase, testowalna w node.

export function procent(got, max) {
  return max ? Math.round((got / max) * 100) : 0;
}

// Najlepszy wynik dla quizu: wyzszy procent wygrywa, remis nie nadpisuje
// (szanujemy starszy rekord — "pierwszy raz zdobyte").
export function lepszyWynik(stary, nowy) {
  if (!stary) return nowy;
  return nowy.pct > stary.pct ? nowy : stary;
}
```

- [ ] **Step 4: Прогнать всё**

Run: `npm test`
Expected: все четыре файла зелёные, суммарно 0 `nie przeszlo`

- [ ] **Step 5: Commit**

```bash
git add src/scripts/wyniki.js test/wyniki.test.mjs
git commit -m "feat: logika wynikow — procent i najlepszy wynik (TDD)"
```

## Task 4: Firebase-обвязка — `chmura.js`

**Files:**
- Create: `src/scripts/chmura.js`

Юнит-тестов нет сознательно: файл — тонкий клей над SDK, вся ветвящаяся логика вынесена в Task 2–3. Проверка — руками в Task 5–7 (dev-сервер + консоль Firestore). Эмулятор Firebase не заводим: для троих юзеров это лишний инструмент (решение из спека).

- [ ] **Step 1: Написать `src/scripts/chmura.js`**

```js
// Most do Firebase: logowanie, zapis wynikow, odczyt profili.
// Cala logika czysta zyje w konto.js / wyniki.js — tu tylko klej.
import { initializeApp } from 'firebase/app';
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged, signOut,
} from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache,
  doc, getDoc, setDoc, addDoc, collection, getDocs, serverTimestamp,
} from 'firebase/firestore';
import { firebaseConfig } from './firebase-config.js';
import { emailOsoby, pinNaHaslo, osobaZeSluga } from './konto.js';
import { lepszyWynik } from './wyniki.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// persistentLocalCache: wyniki zapisane offline dolatuja same po powrocie sieci
const db = initializeFirestore(app, { localCache: persistentLocalCache() });

const KTO_KEY = 'pk_kto_v1'; // cache dla chipa w nawigacji (bez ladowania SDK)

function zapamietajKogo(user) {
  try {
    if (!user) { localStorage.removeItem(KTO_KEY); return; }
    const slug = user.email.split('@')[0];
    const osoba = osobaZeSluga(slug);
    if (osoba) localStorage.setItem(KTO_KEY, JSON.stringify(osoba));
  } catch { /* prywatny tryb — trudno */ }
}

onAuthStateChanged(auth, zapamietajKogo);

// cb dostaje osobe ({slug,name,emoji}) albo null
export function obserwujOsobe(cb) {
  return onAuthStateChanged(auth, (user) => {
    cb(user ? osobaZeSluga(user.email.split('@')[0]) ?? null : null);
  });
}

export async function zaloguj(slug, pin) {
  const email = emailOsoby(slug);
  const haslo = pinNaHaslo(slug, pin);
  try {
    await signInWithEmailAndPassword(auth, email, haslo);
  } catch (e) {
    // Konto moze jeszcze nie istniec — pierwsze logowanie je zaklada.
    // Firebase zwraca ten sam kod dla "brak konta" i "zle haslo"
    // (ochrona przed enumeracja), wiec probujemy zalozyc: jesli email
    // juz zajety — to byl po prostu zly PIN.
    if (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found') {
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, haslo);
        const osoba = osobaZeSluga(slug);
        await setDoc(doc(db, 'users', cred.user.uid), {
          slug, name: osoba.name, emoji: osoba.emoji, best: {},
        });
      } catch (e2) {
        if (e2.code === 'auth/email-already-in-use') throw new Error('Zły PIN.');
        throw e2;
      }
    } else {
      throw e;
    }
  }
}

export function wyloguj() {
  zapamietajKogo(null);
  return signOut(auth);
}

// Zwraca true gdy zapisano, false gdy nikt nie jest zalogowany.
export async function zapiszWynik(quizId, wynik) {
  const user = auth.currentUser;
  if (!user) return false;
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  const best = (snap.exists() && snap.data().best) || {};
  const nowy = { ...wynik, ts: Date.now() };
  best[quizId] = lepszyWynik(best[quizId], nowy);
  await setDoc(ref, { best }, { merge: true });
  await addDoc(collection(db, 'users', user.uid, 'attempts'), {
    quiz: quizId, ...wynik, ts: serverTimestamp(),
  });
  return true;
}

// Profil zalogowanej osoby (z best) albo null.
export async function mojProfil() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(db, 'users', user.uid));
  return snap.exists() ? snap.data() : null;
}

// Wszystkie profile — dashboard "kto co przeszedl" (3 odczyty).
export async function pobierzProfile() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => d.data());
}

// Czeka na ustalenie stanu logowania (pierwszy strzal onAuthStateChanged).
export function gotowyUzytkownik() {
  return new Promise((res) => {
    const stop = onAuthStateChanged(auth, (u) => { stop(); res(u); });
  });
}
```

- [ ] **Step 2: Проверить сборку**

Run: `npm run build`
Expected: `Complete!` (файл ещё не импортируется страницами — сборка просто не должна сломаться)

- [ ] **Step 3: Commit**

```bash
git add src/scripts/chmura.js
git commit -m "feat: chmura.js — logowanie PIN-em i zapis wynikow do Firestore"
```

## Task 5: Страница входа `/profil/` + чип в навигации

**Files:**
- Create: `src/pages/profil.astro`
- Modify: `src/layouts/Base.astro` (навигация, ~строки 37–43)

- [ ] **Step 1: Создать `src/pages/profil.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import { getCollection } from 'astro:content';

const b = import.meta.env.BASE_URL.replace(/\/$/, '');
const href = (p: string) => `${b}/${p.replace(/^\//, '')}`;

// Tytuly quizow do tabeli "moje najlepsze wyniki"
const lekcje = (await getCollection('lekcje')).sort((a, c) => a.data.numer - c.data.numer);
const quizy = [
  ...lekcje.filter((l) => l.data.quiz).map((l) => ({ id: l.data.quiz!, tytul: `${l.data.emoji} ${l.data.tytul}` })),
  { id: 'mix', tytul: '⚡ Wielki Mix' },
];
---
<Base title="Profil — Polski Klub" active="profil">
  <article class="profil">
    <header>
      <p class="kicker" style="color: var(--blekit)">twoje konto</p>
      <h1>Profil</h1>
    </header>

    <!-- ekran logowania -->
    <section id="p-login" hidden>
      <p>Kliknij, kim jesteś, i wpisz swój PIN (4 cyfry). Przy pierwszym logowaniu PIN, który wpiszesz, staje się twoim PIN-em na zawsze.</p>
      <div class="p-osoby" id="p-osoby"></div>
      <form id="p-form" hidden>
        <p class="p-kim">Logujesz się jako <strong id="p-kim"></strong></p>
        <input id="p-pin" class="q-input" type="password" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="off" />
        <button class="btn" type="submit">Zaloguj</button>
        <p class="p-blad" id="p-blad" hidden></p>
      </form>
    </section>

    <!-- ekran zalogowanego -->
    <section id="p-konto" hidden>
      <p class="p-czesc">Cześć, <strong id="p-imie"></strong>! <button class="btn p-wyloguj" id="p-wyloguj">Wyloguj</button></p>
      <h2>Twoje najlepsze wyniki</h2>
      <table class="p-tabela">
        <thead><tr><th>Quiz</th><th>Najlepszy wynik</th></tr></thead>
        <tbody id="p-wyniki"></tbody>
      </table>
      <p class="p-pusto" id="p-pusto" hidden>Jeszcze żadnego quizu — <a href={href('quizy/')}>zagraj pierwszy</a>!</p>
    </section>

    <script type="application/json" id="p-quizy" set:html={JSON.stringify(quizy)} />
  </article>

  <script>
    import { OSOBY, poprawnyPin } from '../scripts/konto.js';
    import { zaloguj, wyloguj, obserwujOsobe, mojProfil } from '../scripts/chmura.js';

    const $ = (id: string) => document.getElementById(id)!;
    const quizy: { id: string; tytul: string }[] = JSON.parse($('p-quizy').textContent!);
    let wybrany = '';

    // przyciski osob
    $('p-osoby').innerHTML = OSOBY.map(
      (o) => `<button class="p-osoba" data-slug="${o.slug}"><span>${o.emoji}</span>${o.name}</button>`
    ).join('');
    $('p-osoby').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.p-osoba') as HTMLElement | null;
      if (!btn) return;
      wybrany = btn.dataset.slug!;
      document.querySelectorAll('.p-osoba').forEach((x) => x.classList.toggle('on', x === btn));
      $('p-kim').textContent = btn.textContent!.trim();
      $('p-form').hidden = false;
      $('p-pin').focus();
    });

    $('p-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pin = ($('p-pin') as HTMLInputElement).value;
      const blad = $('p-blad');
      blad.hidden = true;
      if (!poprawnyPin(pin)) { blad.textContent = 'PIN to 4 cyfry.'; blad.hidden = false; return; }
      try {
        await zaloguj(wybrany, pin);
      } catch (err: any) {
        blad.textContent = err.message === 'Zły PIN.' ? 'Zły PIN.' : 'Nie udało się zalogować. Jest internet?';
        blad.hidden = false;
      }
    });

    $('p-wyloguj').addEventListener('click', () => wyloguj());

    obserwujOsobe(async (osoba) => {
      $('p-login').hidden = !!osoba;
      $('p-konto').hidden = !osoba;
      if (!osoba) return;
      $('p-imie').textContent = `${osoba.emoji} ${osoba.name}`;
      const profil = await mojProfil();
      const best = profil?.best ?? {};
      const wiersze = quizy
        .filter((q) => best[q.id])
        .map((q) => `<tr><td>${q.tytul}</td><td><strong>${best[q.id].pct}%</strong> (${best[q.id].got}/${best[q.id].max})</td></tr>`);
      $('p-wyniki').innerHTML = wiersze.join('');
      $('p-pusto').hidden = wiersze.length > 0;
    });
  </script>

  <style>
    .profil { padding-top: 26px; }
    .p-osoby { display: flex; gap: 12px; flex-wrap: wrap; margin: 18px 0; }
    .p-osoba {
      font-family: var(--font-display); font-weight: 700; font-size: 1.05rem;
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      padding: 18px 26px; background: var(--panel); color: var(--text);
      border: 2px solid var(--line); border-radius: var(--radius); cursor: pointer;
      transition: border-color 0.15s ease, transform 0.15s ease;
    }
    .p-osoba span { font-size: 2rem; }
    .p-osoba:hover { transform: translateY(-3px); }
    .p-osoba.on { border-color: var(--blekit); }
    #p-form { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .p-kim { width: 100%; margin: 0 0 4px; color: var(--text-dim); }
    #p-pin { width: 110px; text-align: center; letter-spacing: 0.4em; font-size: 1.3rem; }
    .p-blad { color: var(--incorrect); width: 100%; margin: 4px 0 0; }
    .p-czesc { display: flex; align-items: center; gap: 14px; font-size: 1.15rem; }
    .p-wyloguj { font-size: 0.85rem; }
    .p-tabela { border-collapse: collapse; width: 100%; max-width: 560px; }
    .p-tabela th, .p-tabela td { border: 1px solid var(--line); padding: 8px 12px; text-align: left; }
    .p-tabela th { background: var(--panel-2); font-family: var(--font-display); }
  </style>
</Base>
```

Примечание: `class="q-input"` берёт готовый стиль инпута из `src/styles/quiz.css` — но он подключается только квиз-движком, поэтому у инпута здесь свой стиль тоже задан; если выглядит голо — это не блокер.

- [ ] **Step 2: Добавить чип в навигацию.** В `src/layouts/Base.astro`:

(a) В типе Props расширить `active`:
```ts
active?: 'lekcje' | 'reguly' | 'quizy' | 'slowka' | 'profil' | '';
```

(b) В `<div class="nav-links">` после ссылки Quizy добавить:
```astro
<a class:list={['nav-link', 'nl-profil', { on: active === 'profil' }]} href={href('profil/')} id="nav-profil">👤</a>
```

(c) Сразу после `</nav>` добавить инлайн-скрипт (без Firebase — читает кэш, который пишет `chmura.js`):
```astro
<script is:inline>
  try {
    const kto = JSON.parse(localStorage.getItem('pk_kto_v1'));
    if (kto && kto.emoji) document.getElementById('nav-profil').textContent = kto.emoji;
  } catch {}
</script>
```

(d) В `<style is:global>` рядом с правилами `.nl-quizy` добавить:
```css
.nl-profil.on, .nl-profil:hover { color: var(--blekit); border-color: var(--blekit); }
```

- [ ] **Step 3: Ручная проверка входа**

Run: `npm run dev`, открыть `http://localhost:4321/polish-hub/profil/`
Expected:
1. Видны три кнопки-аватара; клик по «Żenia» → поле PIN.
2. Ввести PIN `1234` → Zaloguj → появляется «Cześć, 🐺 Żenia!» и пустая таблица с приглашением сыграть квиз.
3. В Firebase Console → Authentication появился юзер `zenia@polskiklub.local`; во Firestore — документ `users/{uid}` с `slug/name/emoji/best`.
4. Wyloguj → снова экран входа. Войти с НЕВЕРНЫМ PIN `9999` → «Zły PIN.»
5. Обновить страницу после входа — сессия жива (login не спрашивается). В навигации чип 🐺.

⚠️ Пока Firestore-правила не поставлены (Task 8), консоль браузера может показать `Missing or insufficient permissions` при записи профиля. Если так — выполнить Task 8 Step 1–2 (вставить правила) и вернуться сюда.

- [ ] **Step 4: Commit**

```bash
git add src/pages/profil.astro src/layouts/Base.astro
git commit -m "feat: strona profilu — logowanie awatarem i PIN-em, chip w nawigacji"
```

## Task 6: Запись результата из квиз-движка

**Files:**
- Modify: `src/pages/quizy/[id].astro:45` (инъекция id)
- Modify: `src/pages/mix.astro:36` (инъекция id)
- Modify: `src/scripts/quiz-engine.js` (метод `renderResults`, ~строка 375)

- [ ] **Step 1: Прокинуть id квиза в данные.** В `src/pages/quizy/[id].astro` строку

```astro
<script type="application/json" id="quiz-data" set:html={JSON.stringify(quizData)} />
```
заменить на
```astro
<script type="application/json" id="quiz-data" set:html={JSON.stringify({ id: lekcja.data.quiz, ...quizData })} />
```

В `src/pages/mix.astro` ту же строку заменить на
```astro
<script type="application/json" id="quiz-data" set:html={JSON.stringify({ id: 'mix', ...quizData })} />
```

- [ ] **Step 2: Дописать сохранение в `renderResults`.** В `src/scripts/quiz-engine.js` в методе `renderResults()` — после строки `this.root.scrollIntoView({ behavior: 'smooth', block: 'start' });` и ПЕРЕД блоком с конфетти — вставить:

```js
    // zapis wyniku do chmury (jesli ktos jest zalogowany)
    if (this.quiz.id) {
      const status = document.createElement('p');
      status.className = 'q-save-status';
      status.textContent = '⏳ zapisuję…';
      this.root.querySelector('.q-results').appendChild(status);
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      // Firestore offline: promise wisi do powrotu sieci — po 4 s uznajemy
      // "zapisze sie pozniej" (persistentLocalCache dowiezie).
      const wyscig = Promise.race([
        import('./chmura.js').then(({ zapiszWynik }) =>
          zapiszWynik(this.quiz.id, { got, max, pct, almost: this.almost })),
        new Promise((res) => setTimeout(() => res('timeout'), 4000)),
      ]);
      wyscig
        .then((r) => {
          if (r === true) status.textContent = '✓ Wynik zapisany';
          else if (r === 'timeout') status.textContent = '✓ Zapisze się, gdy wróci internet';
          else status.innerHTML = `<a href="${base}/profil/">Zaloguj się</a>, żeby zapisywać wyniki`;
        })
        .catch(() => { status.textContent = '⚠️ Nie udało się zapisać wyniku'; });
    }
```

Переменные `got`, `max`, `pct` уже определены в начале `renderResults` — код вставляется в ту же область видимости.

- [ ] **Step 3: Стиль статуса.** В `src/styles/quiz.css` в конец файла добавить:

```css
.q-save-status { margin: 14px 0 0; font-size: 0.9rem; color: var(--text-dim); }
.q-save-status a { color: var(--amber); }
```

- [ ] **Step 4: Ручная проверка**

Run: `npm run dev`, войти на `/profil/`, пройти короткий квиз (любой) до конца.
Expected:
1. На экране результатов — «✓ Wynik zapisany».
2. Firestore Console: `users/{uid}` → поле `best` содержит `{<quizId>: {pct, got, max, almost, ts}}`; подколлекция `attempts` — 1 документ.
3. Пройти тот же квиз хуже → `best` НЕ изменился, в `attempts` добавился документ.
4. Разлогиниться, пройти квиз → «Zaloguj się, żeby zapisywać wyniki».

- [ ] **Step 5: Прогнать тесты и сборку**

Run: `npm test && npm run build`
Expected: тесты зелёные (движок логику счёта не менял), build `Complete!`

- [ ] **Step 6: Commit**

```bash
git add src/pages/quizy/[id].astro src/pages/mix.astro src/scripts/quiz-engine.js src/styles/quiz.css
git commit -m "feat: quiz zapisuje wynik do chmury — best + historia prob"
```

## Task 7: Дашборд «кто что прошёл» на главной

**Files:**
- Modify: `src/pages/index.astro` (после секции `.latest`, перед `.mix-card`)

- [ ] **Step 1: Добавить секцию.** В `src/pages/index.astro` в frontmatter после строки `const quizy = lekcje.filter((l) => l.data.quiz);` добавить:

```ts
const quizyDash = [
  ...quizy.map((l) => ({ id: l.data.quiz!, tytul: `${l.data.emoji} ${String(l.data.numer).padStart(2, '0')}` })),
  { id: 'mix', tytul: '⚡ Mix' },
];
```

В разметке после закрывающего `</section>` секции `latest` (строка `<p class="latest-all">…</p>` включительно) и перед `<a class="mix-card"` вставить:

```astro
  <section class="klub" id="klub">
    <h2 class="section-title">Klub — kto co przeszedł</h2>
    <p class="klub-zacheta" id="klub-zacheta">
      <a href={href('profil/')}>Zaloguj się</a>, żeby zbierać wyniki i widzieć postęp całej trójki.
    </p>
    <div class="klub-tabela-wrap" id="klub-wrap" hidden>
      <table class="klub-tabela"><thead id="klub-head"></thead><tbody id="klub-body"></tbody></table>
    </div>
    <script type="application/json" id="klub-quizy" set:html={JSON.stringify(quizyDash)} />
  </section>
```

- [ ] **Step 2: Скрипт секции.** В `index.astro` перед закрывающим `</Base>` (после `.mix-card`) добавить:

```astro
  <script>
    import { gotowyUzytkownik, pobierzProfile } from '../scripts/chmura.js';

    const quizy: { id: string; tytul: string }[] = JSON.parse(document.getElementById('klub-quizy')!.textContent!);

    gotowyUzytkownik().then(async (user) => {
      if (!user) return; // zostaje zacheta do logowania
      const profile = await pobierzProfile();
      profile.sort((a, b) => a.name.localeCompare(b.name));
      document.getElementById('klub-zacheta')!.hidden = true;
      document.getElementById('klub-wrap')!.hidden = false;
      document.getElementById('klub-head')!.innerHTML =
        `<tr><th>Quiz</th>${profile.map((p) => `<th>${p.emoji} ${p.name}</th>`).join('')}</tr>`;
      document.getElementById('klub-body')!.innerHTML = quizy.map((q) =>
        `<tr><td>${q.tytul}</td>${profile.map((p) => {
          const w = p.best?.[q.id];
          return `<td>${w ? `<strong>${w.pct}%</strong>` : '—'}</td>`;
        }).join('')}</tr>`
      ).join('');
    });
  </script>
```

- [ ] **Step 3: Стили секции.** В `<style>` внизу `index.astro` добавить:

```css
  .klub-zacheta { color: var(--text-dim); }
  .klub-tabela-wrap { overflow-x: auto; }
  .klub-tabela { border-collapse: collapse; width: 100%; }
  .klub-tabela th, .klub-tabela td { border: 1px solid var(--line); padding: 7px 12px; text-align: left; font-size: 0.92rem; }
  .klub-tabela th { background: var(--panel-2); font-family: var(--font-display); }
  .klub-tabela td strong { color: var(--zielony); }
```

- [ ] **Step 4: Ручная проверка**

Run: `npm run dev`, открыть главную.
Expected: без входа — приглашение «Zaloguj się…»; после входа — таблица: строки-квизы, три колонки людей, у тебя проценты из Task 6, у остальных «—».

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: dashboard klubu na glownej — kto co przeszedl"
```

## Task 8: Security Rules

**Files:**
- Create: `firestore.rules` (в корне репо — источник правды; в консоль вставляется копия)

- [ ] **Step 1: Создать `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Profile: czytac moze kazdy zalogowany (dashboard trojki),
    // pisac — tylko wlasciciel do swojego dokumentu.
    match /users/{uid} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null && request.auth.uid == uid;
      allow delete: if false;

      // Historia prob: dopisywanie tylko u siebie, bez edycji i kasowania.
      match /attempts/{attemptId} {
        allow read: if request.auth != null;
        allow create: if request.auth != null && request.auth.uid == uid;
        allow update, delete: if false;
      }
    }
  }
}
```

- [ ] **Step 2: Вставить в консоль.** Firebase Console → Firestore Database → Rules → заменить содержимое на файл выше → **Publish**.

- [ ] **Step 3: Негативная проверка руками.** В браузере (dev-сервер, залогинен как Żenia) в DevTools Console выполнить попытку записи в чужой документ — должно упасть:

на странице профиля выполнить:
```js
const { getFirestore, doc, setDoc } = await import('firebase/firestore');
await setDoc(doc(getFirestore(), 'users', 'obcy-uid'), { hack: true });
```
Expected: ошибка `FirebaseError: Missing or insufficient permissions` — чужое писать нельзя. (Свои записи из Task 6 при этом работают.)

- [ ] **Step 4: Commit**

```bash
git add firestore.rules
git commit -m "feat: firestore security rules — zapis tylko do wlasnego profilu"
```

## Task 9: Финальная верификация

**Files:** нет новых

- [ ] **Step 1: Всё зелёное**

Run: `npm test && npm run build`
Expected: 4 тест-файла без FAIL, build `Complete!`

- [ ] **Step 2: Сквозной прогон на dev-сервере** — чеклист:
1. `/profil/` → вход Żenia + PIN → «Cześć, 🐺 Żenia!»
2. Квиз до конца → «✓ Wynik zapisany», best в профиле
3. Главная → таблица клуба с процентами
4. Wyloguj → квиз → «Zaloguj się, żeby zapisywać wyniki»
5. Чип в навигации: 👤 без входа, 🐺 после

- [ ] **Step 3: Push (Женя, руками)**

```bash
git log --oneline main ^origin/main   # посмотреть, что уедет
git push origin main
```
После деплоя Pages повторить сквозной прогон на проде: `https://zhenkoest1.github.io/polish-hub/profil/`. Прод — то же Firebase-приложение, отдельной настройки не нужно (домен `zhenkoest1.github.io` разрешён по умолчанию? — НЕТ: если логин на проде упадёт с `auth/unauthorized-domain`, добавить домен: Console → Authentication → Settings → Authorized domains → Add domain → `zhenkoest1.github.io`).

- [ ] **Step 4: Обновить волт** — в Hub-ноде (`3. Projects/Polish Learning Hub/Polish Learning Hub.md`): отметить задачу этапа 1 выполненной, дописать строку в «Лог», поднять `progress`. Первые PIN-ы: каждый (Олег, Лена, Женя) вводит свой PIN при первом входе сам — PIN-ы нигде не записывать, в том числе в волт.

---

## Self-review (выполнен)

- **Покрытие спека (секция 1 этапа 1):** вход аватар+PIN ✓ (Task 5), запись результатов ✓ (Task 6), лучшие результаты ✓ (Task 4/6), дашборд свой ✓ (Task 5) и общий ✓ (Task 7), защита записи ✓ (Task 8). Подколлекции `leitner/topics/streak` — этап 2, в этот план сознательно не входят.
- **Плейсхолдеров нет**; единственные «WKLEJ_Z_KONSOLI» — реальные значения из Task 0, у исполнителя есть точная инструкция, откуда их взять.
- **Согласованность имён:** `zaloguj/wyloguj/zapiszWynik/mojProfil/pobierzProfile/obserwujOsobe/gotowyUzytkownik` — сверено между Task 4 (определение) и Task 5–7 (использование); `pk_kto_v1` — сверено Task 4 ↔ Task 5(c); `lepszyWynik/procent` — Task 3 ↔ Task 4.
