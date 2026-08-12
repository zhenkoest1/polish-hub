// Sesja = 40 minut nauki zlozone z tego, co juz jest w kursie.
// Tu siedzi sama logika doboru blokow: bez DOM-u, bez Firebase, bez Date.now() —
// wszystko wchodzi argumentami, wiec test da sie napisac deterministycznie.
//
// Blok: { rodzaj: 'slowka'|'gramatyka'|'quiz'|'pisanie', minuty, tytul, dane }
//
// Budzet minut jest staly. Kiedy blok odpada (brak slowek na dzis, lekcja bez
// quizu, kurs bez pisania), jego minuty przejmuje gramatyka — sesja ma trwac
// 40 minut niezaleznie od tego, ile materialu akurat jest pod reka.

const MIN_SLOWKA = 5;
const MIN_GRAMATYKA = 12;
const MIN_QUIZ = 13;
const MIN_PISANIE = 10;

// Powyzej ~20 kart powtorka przestaje sie miescic w pieciu minutach.
const LIMIT_SLOWEK = 20;

const DZIEN_MS = 86400000;

/**
 * @param {object} wejscie
 * @param {Array} wejscie.slowaDoPowtorki  slowa zaplanowane na dzis (moze byc puste)
 * @param {Array} wejscie.lekcje           lekcje w kolejnosci kursu
 * @param {string|null} wejscie.ostatniaLekcja  id lekcji z poprzedniej sesji
 * @returns {{ bloki: Array, minutyRazem: number }}
 *
 * Funkcja jest w pelni deterministyczna: nie wola Date.now() i nie losuje.
 * Kolejnosc lekcji rozstrzyga `ostatniaLekcja`, a kolejke slow ustawia juz
 * silnik Leitnera (najbardziej zalegle na poczatku) — bierzemy pierwsze 20.
 */
export function zbudujSesje({ slowaDoPowtorki, lekcje, ostatniaLekcja } = {}) {
  const kurs = Array.isArray(lekcje) ? lekcje.filter(Boolean) : [];
  const slowa = (Array.isArray(slowaDoPowtorki) ? slowaDoPowtorki : []).slice(0, LIMIT_SLOWEK);

  // Pusta lista lekcji = tresc sie nie zaladowala. Nie ma sesji do zlozenia.
  if (kurs.length === 0) return { bloki: [], minutyRazem: 0 };

  const bloki = [];

  if (slowa.length > 0) {
    bloki.push({
      rodzaj: 'slowka',
      minuty: MIN_SLOWKA,
      tytul: 'Powtórka słówek',
      dane: { slowa },
    });
  }

  const lekcja = wybierzLekcjeGramatyki(kurs, ostatniaLekcja);

  // Zaden temat nie ma cwiczen — nie ma wokol czego zbudowac gramatyki, a wiec
  // i quizu ani pisania (oba wisza na tej samej lekcji). Powtorka slowek stoi
  // osobno i zostaje: jest czym sie zajac, choc krocej niz 40 minut.
  if (!lekcja) return zamknij(bloki);

  const tytulLekcji = lekcja.tytul || `Lekcja ${lekcja.numer ?? ''}`.trim();

  const quiz = lekcja.quiz || null;
  const lekcjaPisania = znajdzLekcjeZPisaniem(kurs, lekcja);

  // Gramatyka jest workiem na minuty po blokach, ktore odpadly.
  const minutyGramatyki =
    MIN_GRAMATYKA +
    (slowa.length > 0 ? 0 : MIN_SLOWKA) +
    (quiz ? 0 : MIN_QUIZ) +
    (lekcjaPisania ? 0 : MIN_PISANIE);

  bloki.push({
    rodzaj: 'gramatyka',
    minuty: minutyGramatyki,
    tytul: tytulLekcji,
    dane: { lekcja },
  });

  if (quiz) {
    bloki.push({
      rodzaj: 'quiz',
      minuty: MIN_QUIZ,
      tytul: `Quiz: ${tytulLekcji}`,
      dane: { lekcja, quiz },
    });
  }

  if (lekcjaPisania) {
    bloki.push({
      rodzaj: 'pisanie',
      minuty: MIN_PISANIE,
      tytul: `Pisanie: ${lekcjaPisania.tytul || tytulLekcji}`,
      dane: { lekcja: lekcjaPisania },
    });
  }

  return zamknij(bloki);
}

function zamknij(bloki) {
  return { bloki, minutyRazem: bloki.reduce((s, b) => s + b.minuty, 0) };
}

// Rotacja: bierzemy pierwsza lekcje z cwiczeniami PO tej z poprzedniej sesji,
// z zawijaniem na koniec kursu. Brak lub nieznane `ostatniaLekcja` (np. lekcja
// zniknela z tresci) = start od poczatku kursu.
function wybierzLekcjeGramatyki(kurs, ostatniaLekcja) {
  const i = kurs.findIndex((l) => l.id === ostatniaLekcja);
  const start = i === -1 ? 0 : i + 1;

  for (let k = 0; k < kurs.length; k++) {
    const l = kurs[(start + k) % kurs.length];
    if (l.maCwiczenia === true) return l;
  }
  return null;
}

// Pisanie bierzemy z tej samej lekcji, a jak jej brakuje — cofamy sie w kursie.
// Wstecz, nie w przod: material, ktory uczen juz przerobil, jest bezpieczniejszy
// niz zadanie z lekcji, do ktorej jeszcze nie doszedl.
function znajdzLekcjeZPisaniem(kurs, lekcja) {
  const start = Math.max(0, kurs.indexOf(lekcja));

  for (let k = 0; k < kurs.length; k++) {
    const l = kurs[(((start - k) % kurs.length) + kurs.length) % kurs.length];
    if (l.maPisanie === true) return l;
  }
  return null;
}

/**
 * Dlugosc serii dni z nauka, liczona wstecz od dzis.
 * @param {string[]} daty  daty sesji 'YYYY-MM-DD', dowolna kolejnosc, moga sie powtarzac
 * @param {string} dzis    'YYYY-MM-DD'
 * @returns {number}
 */
export function policzStreak(daty, dzis) {
  // Date.parse('YYYY-MM-DD') to UTC (ECMA-262), wiec odjecie 86400000 ms zawsze
  // laduje na poprzednim dniu kalendarzowym. Na lokalnych datach doba zmiany
  // czasu ma 23 lub 25 godzin i seria gubilaby albo dublowala dzien.
  const dzisMs = dzienMs(dzis);
  if (dzisMs === null || !Array.isArray(daty)) return 0;

  const dni = new Set();
  for (const d of daty) {
    const ms = dzienMs(d);
    // Daty z przyszlosci (zle zegary, import) ignorujemy — inaczej "najnowsza
    // sesja" wypadalaby poza dzis i seria zerowalaby sie bez powodu.
    if (ms !== null && ms <= dzisMs) dni.add(ms);
  }
  if (dni.size === 0) return 0;

  // reduce, nie Math.max(...dni) — spread wysypalby sie na bardzo dlugiej historii
  let najnowszy = -Infinity;
  for (const ms of dni) if (ms > najnowszy) najnowszy = ms;

  // Wczoraj tez sie liczy: uczen po prostu jeszcze dzis nie usiadl do nauki,
  // seria jest zywa az do polnocy. Starsza sesja = seria przerwana.
  if (najnowszy !== dzisMs && najnowszy !== dzisMs - DZIEN_MS) return 0;

  let seria = 0;
  for (let ms = najnowszy; dni.has(ms); ms -= DZIEN_MS) seria++;
  return seria;
}

function dzienMs(data) {
  if (typeof data !== 'string') return null;
  // slice(0,10) — gdyby ktos podal pelny znacznik ISO, liczy sie sam dzien
  const ms = Date.parse(data.slice(0, 10));
  return Number.isFinite(ms) ? ms : null;
}
