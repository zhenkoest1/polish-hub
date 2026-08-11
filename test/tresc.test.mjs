/**
 * Walidacja treści kursu — lekcje, quizy i talie słówek.
 *
 * Te pliki powstają masowo i najgroźniejsze błędy są ciche: quiz się zbuduje
 * i wyświetli, ale pytania nie da się zaliczyć. Dlatego sprawdzamy je tutaj,
 * a nie dopiero oczami na spotkaniu.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KORZEN = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = (...c) => join(KORZEN, ...c);

let ok = 0;
const bledy = [];
const sprawdz = (nazwa, warunek) => (warunek ? ok++ : bledy.push(nazwa));

const czytajJSON = (sciezka) => JSON.parse(readFileSync(sciezka, 'utf-8'));
const pliki = (kat, ext) => readdirSync(P(kat)).filter((f) => f.endsWith(ext)).sort();

// ——— Lekcje ———————————————————————————————————————————————
const lekcje = pliki('src/content/lekcje', '.md');
const numery = new Set();

for (const f of lekcje) {
  const tekst = readFileSync(P('src/content/lekcje', f), 'utf-8');
  const etykieta = `lekcja ${f}`;

  sprawdz(`${etykieta}: zaczyna się frontmatterem`, tekst.startsWith('---'));
  const fm = tekst.split('---')[1] ?? '';

  for (const klucz of ['numer', 'tytul', 'emoji', 'gramatyka']) {
    sprawdz(`${etykieta}: ma ${klucz}`, fm.includes(`${klucz}:`));
  }

  const numer = Number(fm.match(/numer:\s*(\d+)/)?.[1]);
  sprawdz(`${etykieta}: numer jest liczbą`, Number.isInteger(numer));
  sprawdz(`${etykieta}: numer ${numer} nie powtarza się`, !numery.has(numer));
  numery.add(numer);

  // Deklarowany quiz musi istnieć — inaczej Astro wywala się przy budowaniu
  const quiz = fm.match(/quiz:\s*"([^"]+)"/)?.[1];
  if (quiz) {
    sprawdz(`${etykieta}: quiz "${quiz}" istnieje`, existsSync(P('src/data/quizzes', `${quiz}.json`)));
  }

  // Śmieci po generowaniu
  sprawdz(`${etykieta}: bez śmieciowych tagów`, !/<\/(content|invoke|parameter)>/.test(tekst));
  sprawdz(`${etykieta}: parzyste bloki kodu`, (tekst.match(/```/g) ?? []).length % 2 === 0);

  // Sekcje, na których opiera się format lekcji.
  // Każda lekcja musi mieć ćwiczenia ustne i blok gramatyczny — ale nagłówek
  // bloku bywa różny ("Reguła", "Panel przypadków", "Blok 1"), więc szukamy
  // prefiksu, nie dokładnego brzmienia.
  sprawdz(`${etykieta}: ma ćwiczenia ustne`, tekst.includes('## 🗣️ Na spotkaniu'));
  sprawdz(`${etykieta}: ma blok gramatyczny (## 📐)`, tekst.includes('## 📐 '));

  // Lekcje powtórzeniowe świadomie nie mają jednego tekstu ani własnej listy
  // słów — powtarzają materiał z poprzednich. Reszta musi mieć oba.
  const POWTORZENIOWE = new Set(['05-powtorzenie.md']);
  if (!POWTORZENIOWE.has(f)) {
    sprawdz(`${etykieta}: ma tekst do czytania`, tekst.includes('## 📖 Tekst'));
    sprawdz(`${etykieta}: ma listę słów`, tekst.includes('## 📝 Słowa z tekstu'));
  }
}
sprawdz('są jakieś lekcje', lekcje.length > 0);

// ——— Quizy ————————————————————————————————————————————————
const TYPY = new Set(['tf', 'mc', 'typein', 'match', 'tap_fill']);

for (const f of pliki('src/data/quizzes', '.json')) {
  const etykieta = `quiz ${f}`;
  let q;
  try {
    q = czytajJSON(P('src/data/quizzes', f));
    ok++;
  } catch (e) {
    bledy.push(`${etykieta}: niepoprawny JSON — ${e.message}`);
    continue;
  }

  sprawdz(`${etykieta}: ma title`, typeof q.title === 'string' && q.title.length > 0);
  sprawdz(`${etykieta}: ma sections`, Array.isArray(q.sections) && q.sections.length > 0);

  for (const [i, s] of (q.sections ?? []).entries()) {
    const se = `${etykieta} sekcja ${i} (${s.type})`;
    sprawdz(`${se}: znany typ`, TYPY.has(s.type));
    sprawdz(`${se}: ma pytania`, Array.isArray(s.questions) && s.questions.length > 0);

    for (const [j, p] of (s.questions ?? []).entries()) {
      const pe = `${se} pytanie ${j}`;

      if (s.type === 'tf') {
        sprawdz(`${pe}: answer to boolean`, typeof p.answer === 'boolean');
        sprawdz(`${pe}: ma treść`, typeof p.q === 'string' && p.q.length > 0);
      }

      if (s.type === 'mc') {
        sprawdz(`${pe}: ma co najmniej 2 opcje`, Array.isArray(p.options) && p.options.length >= 2);
        // Najgroźniejszy cichy błąd: odpowiedzi nie ma wśród opcji,
        // więc pytania nie da się zaliczyć, a build i tak przechodzi.
        sprawdz(`${pe}: answer jest jedną z opcji`, (p.options ?? []).includes(p.answer));
        sprawdz(`${pe}: opcje bez duplikatów`, new Set(p.options ?? []).size === (p.options ?? []).length);
      }

      if (s.type === 'typein') {
        // Silnik przyjmuje answer jako string LUB tablicę dopuszczalnych odpowiedzi
        // (Array.isArray w quiz-engine.js) — walidator musi znać obie formy
        const odpTypein = Array.isArray(p.answer) ? p.answer : [p.answer];
        sprawdz(`${pe}: ma answer`, odpTypein.length > 0 && odpTypein.every((a) => typeof a === 'string' && a.trim().length > 0));
        sprawdz(`${pe}: ma lukę "__"`, typeof p.q === 'string' && p.q.includes('__'));
      }

      if (s.type === 'match') {
        const pary = p.pairs ?? [];
        sprawdz(`${pe}: ma co najmniej 3 pary`, Array.isArray(pary) && pary.length >= 3);
        sprawdz(`${pe}: każda para ma 2 elementy`, pary.every((x) => Array.isArray(x) && x.length === 2));
        sprawdz(`${pe}: lewe strony unikalne`, new Set(pary.map((x) => x[0])).size === pary.length);
      }

      if (s.type === 'tap_fill') {
        const odp = p.answers ?? [];
        sprawdz(`${pe}: ma answers`, Array.isArray(odp) && odp.length > 0);
        // Każdy {n} w tekście musi mieć odpowiedź i odwrotnie
        const wTekscie = [...(p.text ?? '').matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1]));
        sprawdz(`${pe}: liczba luk == liczba odpowiedzi`, wTekscie.length === odp.length);
        sprawdz(
          `${pe}: indeksy luk 0..${odp.length - 1}`,
          [...wTekscie].sort((a, b) => a - b).every((v, k) => v === k)
        );
      }
    }
  }
}

// ——— Słówka ———————————————————————————————————————————————
const CZESCI = new Set([
  'rzeczownik', 'czasownik', 'przymiotnik', 'przysłówek', 'wyrażenie', 'przyimek', 'spójnik',
]);
const wszystkieId = new Map();

for (const f of pliki('src/data/slowka', '.json')) {
  const etykieta = `słówka ${f}`;
  let d;
  try {
    d = czytajJSON(P('src/data/slowka', f));
    ok++;
  } catch (e) {
    bledy.push(`${etykieta}: niepoprawny JSON — ${e.message}`);
    continue;
  }

  sprawdz(`${etykieta}: ma numer lekcji`, Number.isInteger(d.lekcja));
  sprawdz(`${etykieta}: ma temat`, typeof d.temat === 'string' && d.temat.length > 0);
  sprawdz(`${etykieta}: ma słowa`, Array.isArray(d.slowa) && d.slowa.length > 0);

  for (const w of d.slowa ?? []) {
    const we = `${etykieta} [${w.id}]`;
    for (const klucz of ['id', 'pl', 'ru', 'czesc', 'przyklad', 'przyklad_ru']) {
      sprawdz(`${we}: ma ${klucz}`, typeof w[klucz] === 'string' && w[klucz].length > 0);
    }
    sprawdz(`${we}: znana część mowy`, CZESCI.has(w.czesc));
    sprawdz(`${we}: rodzaj tylko przy rzeczowniku`,
      w.czesc === 'rzeczownik' ? ['m', 'ż', 'n'].includes(w.rodzaj) : w.rodzaj === undefined);
    sprawdz(`${we}: aspekt tylko przy czasowniku`,
      w.czesc === 'czasownik' ? ['dk', 'ndk'].includes(w.aspekt) : w.aspekt === undefined);
    sprawdz(`${we}: bez gwiazdek w przykładzie`, !w.przyklad.includes('*'));

    // id to klucz w localStorage — kolizja zlewa postęp dwóch różnych słów
    if (wszystkieId.has(w.id)) bledy.push(`${we}: id powtarza się (${wszystkieId.get(w.id)})`);
    else { wszystkieId.set(w.id, f); ok++; }
  }
}

// ——— Linki wewnętrzne ——————————————————————————————————————
const reguly = new Set(pliki('src/content/reguly', '.md').map((f) => f.replace('.md', '')));
const idLekcji = new Set(lekcje.map((f) => f.replace('.md', '')));

for (const [kat, zbior] of [['lekcje', idLekcji], ['reguly', reguly]]) {
  for (const f of pliki(`src/content/${kat}`, '.md')) {
    const tekst = readFileSync(P(`src/content/${kat}`, f), 'utf-8');
    for (const m of tekst.matchAll(/\]\(\/polish-hub\/(reguly|lekcje)\/([a-z0-9-]+)\/\)/g)) {
      const cel = m[1] === 'reguly' ? reguly : idLekcji;
      sprawdz(`${kat}/${f}: link -> /${m[1]}/${m[2]}/`, cel.has(m[2]));
    }
  }
  void zbior;
}

// ——— Wynik ————————————————————————————————————————————————
console.log(`lekcje: ${lekcje.length} · słówka: ${wszystkieId.size} · sprawdzeń: ${ok + bledy.length}`);
if (bledy.length) {
  console.log(`\n${bledy.length} BŁĘDÓW:`);
  for (const b of bledy.slice(0, 40)) console.log('  ✗', b);
  if (bledy.length > 40) console.log(`  … i ${bledy.length - 40} więcej`);
  process.exit(1);
}
console.log(`${ok} przeszło, 0 nie przeszło`);
