/**
 * Fiszki — silnik powtórek rozłożonych w czasie (system Leitnera).
 *
 * Postęp trzymamy w localStorage, bo kurs jest dla trzech osób i każda uczy się
 * na swoim urządzeniu. Nie ma backendu i na tym etapie nie jest potrzebny.
 *
 * Pudełka 1–5. Poprawna odpowiedź przesuwa słowo o jedno pudełko w górę,
 * błędna wraca je do pudełka 1 — to cała idea Leitnera.
 */

const KLUCZ = 'pk_slowka_v1';

/** Odstępy w dniach dla pudełek 1–5. Pudełko 5 = słowo umiane. */
export const ODSTEPY = [0, 1, 3, 7, 21];
export const MAX_PUDELKO = 5;

const DZIEN = 24 * 60 * 60 * 1000;

/** Cały stan z localStorage. Nigdy nie rzuca — zepsuty JSON traktujemy jak pusty. */
export function wczytajStan() {
  try {
    const surowe = localStorage.getItem(KLUCZ);
    if (!surowe) return {};
    const dane = JSON.parse(surowe);
    return dane && typeof dane === 'object' ? dane : {};
  } catch {
    return {};
  }
}

export function zapiszStan(stan) {
  try {
    localStorage.setItem(KLUCZ, JSON.stringify(stan));
  } catch {
    /* tryb prywatny albo brak miejsca — uczymy się dalej, tylko bez zapisu */
  }
}

/** Stan pojedynczego słowa; słowo nowe = pudełko 0, termin już minął. */
export function stanSlowa(stan, id) {
  return stan[id] ?? { pudelko: 0, termin: 0, widziane: 0, dobre: 0 };
}

/** Licznik z zapisanego stanu; stany sprzed danego pola dają 0, nigdy NaN. */
function licznik(wartosc) {
  return Number.isFinite(wartosc) ? wartosc : 0;
}

/** Czy słowo czeka na powtórkę teraz? */
export function czyDoPowtorki(stan, id, teraz = Date.now()) {
  const s = stanSlowa(stan, id);
  return s.termin <= teraz;
}

/**
 * Zapisuje odpowiedź i wylicza nowy termin.
 * ocena: 'wiem' | 'prawie' | 'nie-wiem'
 */
export function oceń(stan, id, ocena, teraz = Date.now()) {
  const s = stanSlowa(stan, id);
  let pudelko;

  if (ocena === 'wiem') pudelko = Math.min(s.pudelko + 1, MAX_PUDELKO);
  else if (ocena === 'prawie') pudelko = Math.max(s.pudelko, 1); // zostaje, ale nie cofa
  else pudelko = 1; // 'nie-wiem' — z powrotem na początek

  const dni = ODSTEPY[Math.min(pudelko, ODSTEPY.length - 1)] ?? 0;

  stan[id] = {
    pudelko,
    termin: teraz + dni * DZIEN,
    widziane: licznik(s.widziane) + 1,
    dobre: licznik(s.dobre) + (ocena === 'wiem' ? 1 : 0),
  };
  zapiszStan(stan);
  return stan[id];
}

/**
 * Kolejka na sesję: najpierw zaległe powtórki (od najdawniej zaległych),
 * potem słowa nigdy nie widziane. Dzięki temu nie zasypujemy się nowymi
 * słowami, póki stare nie są utrwalone.
 */
export function zbudujKolejke(slowa, stan, limit = 20, teraz = Date.now()) {
  const doPowtorki = [];
  const nowe = [];

  for (const s of slowa) {
    const st = stanSlowa(stan, s.id);
    if (st.pudelko >= MAX_PUDELKO && st.termin > teraz) continue; // umiane
    if (st.pudelko === 0) nowe.push(s);
    else if (st.termin <= teraz) doPowtorki.push({ slowo: s, termin: st.termin });
  }

  doPowtorki.sort((a, b) => a.termin - b.termin);
  return [...doPowtorki.map((x) => x.slowo), ...nowe].slice(0, limit);
}

/** Liczby na kafelki i paski postępu. */
export function statystyki(slowa, stan, teraz = Date.now()) {
  let nowe = 0;
  let wTrakcie = 0;
  let umiane = 0;
  let zalegle = 0;

  for (const s of slowa) {
    const st = stanSlowa(stan, s.id);
    if (st.pudelko === 0) nowe++;
    else if (st.pudelko >= MAX_PUDELKO && st.termin > teraz) umiane++;
    else wTrakcie++;
    // Zaległe = wszystko poza nowymi, czemu minął termin — także słowa
    // z pudełka 5, bo po 21 dniach wracają na jedno sprawdzenie.
    if (st.pudelko > 0 && st.termin <= teraz) zalegle++;
  }

  const razem = slowa.length;
  return {
    razem,
    nowe,
    wTrakcie,
    umiane,
    zalegle,
    doNauki: nowe + zalegle,
    procent: razem ? Math.round((umiane / razem) * 100) : 0,
  };
}

/** Tasowanie Fishera–Yatesa — kolejność ma być inna przy każdym podejściu. */
export function potasuj(tablica) {
  const a = [...tablica];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Porównanie odpowiedzi wpisanej z klawiatury — bez ogonków i wielkości liter. */
export function bezOgonkow(tekst) {
  return (tekst || '')
    .toLowerCase()
    .trim()
    .replace(/ą/g, 'a')
    .replace(/ć/g, 'c')
    .replace(/ę/g, 'e')
    .replace(/ł/g, 'l')
    .replace(/ń/g, 'n')
    .replace(/ó/g, 'o')
    .replace(/ś/g, 's')
    .replace(/[żź]/g, 'z');
}

export function odpowiedzPoprawna(wpisane, oczekiwane) {
  return bezOgonkow(wpisane) === bezOgonkow(oczekiwane);
}
