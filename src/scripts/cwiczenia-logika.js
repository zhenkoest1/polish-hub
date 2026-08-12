// Blok ```cwiczenie w markdown lekcji zawiera JSON:
// { "typ": "wybor", "tytul": "...", "instrukcja": "...",
//   "zdania": [ { "przed": "Wczoraj cały wieczór ", "opcje": ["czytać", "przeczytać"],
//                 "dobra": 0, "po": " tę książkę.", "czemu": "cały wieczór = proces → ndk" } ] }
// { "typ": "wpisz", "tytul": "...", "instrukcja": "...",
//   "zdania": [ { "przed": "pisać → ", "odpowiedz": ["napisać"], "po": "", "czemu": "..." } ] }
// "dokladnie": true — diakrytyki znacza (jedz ≠ jedź), brak "prawie"
// { "typ": "pisanie", "tytul": "...", "instrukcja": "...",
//   "zdania": [ { "przed": "1. Co zacząłem i nie skończyłem?", "po": "", "czemu": "ndk, czas przeszły" } ] }
// (pisanie = wolny tekst do zeszytu — nie ma poprawnej odpowiedzi do sprawdzenia)

import { stripDiacritics, norm } from './tekst.js';

const TYPY = ['wybor', 'wpisz', 'pisanie'];

export function parsujCwiczenie(tekstJson) {
  let dane;
  try {
    dane = JSON.parse(tekstJson);
  } catch (e) {
    return { ok: false, blad: 'niepoprawny JSON: ' + e.message };
  }

  if (!TYPY.includes(dane.typ)) {
    return { ok: false, blad: `nieznany typ: ${dane.typ}` };
  }

  if (!Array.isArray(dane.zdania) || dane.zdania.length === 0) {
    return { ok: false, blad: 'zdania: pusta lista' };
  }

  // pola opcjonalne, ale jesli sa — musza byc stringami (inaczej [object Object] w UI)
  for (const pole of ['tytul', 'instrukcja']) {
    if (dane[pole] !== undefined && typeof dane[pole] !== 'string') {
      return { ok: false, blad: `${pole}: musi być stringiem` };
    }
  }

  for (const [i, z] of dane.zdania.entries()) {
    const gdzie = `zdanie ${i + 1}`;

    if (typeof z.przed !== 'string' || typeof z.po !== 'string') {
      return { ok: false, blad: `${gdzie}: przed/po muszą być stringami` };
    }

    if (z.czemu !== undefined && typeof z.czemu !== 'string') {
      return { ok: false, blad: `${gdzie}: czemu musi być stringiem` };
    }

    if (dane.typ === 'wybor') {
      if (
        !Array.isArray(z.opcje) ||
        z.opcje.length < 2 ||
        !z.opcje.every((o) => typeof o === 'string' && o.length > 0)
      ) {
        return { ok: false, blad: `${gdzie}: opcje — min. 2 niepuste stringi` };
      }

      if (!Number.isInteger(z.dobra) || z.dobra < 0 || z.dobra >= z.opcje.length) {
        return { ok: false, blad: `${gdzie}: dobra poza zakresem` };
      }
    }

    if (dane.typ === 'wpisz') {
      if (
        !Array.isArray(z.odpowiedz) ||
        z.odpowiedz.length === 0 ||
        !z.odpowiedz.every((o) => typeof o === 'string' && o.trim().length > 0)
      ) {
        return { ok: false, blad: `${gdzie}: odpowiedz — niepusta lista stringów` };
      }

      if (z.dokladnie !== undefined && typeof z.dokladnie !== 'boolean') {
        return { ok: false, blad: `${gdzie}: dokladnie musi być boolean` };
      }
    }
  }

  return { ok: true, dane };
}

export function sprawdzWybor(zdanie, wybranyIndex) {
  return zdanie.dobra === wybranyIndex;
}

// 'dobrze' | 'prawie' (brak polskich znaków) | 'zle'
export function sprawdzWpisz(zdanie, wpisane) {
  const val = norm(wpisane ?? '');
  if (!val) return 'zle';

  if (zdanie.odpowiedz.some((a) => norm(a) === val)) return 'dobrze';

  // dokladnie: para minimalna (jedz = jedz!, jedź = jedz samochodem) — tu brak ogonka
  // to inne slowo, a nie literowka. "Prawie" przeklamaloby cala lekcje na blad.
  if (zdanie.dokladnie === true) return 'zle';

  if (zdanie.odpowiedz.some((a) => stripDiacritics(a) === stripDiacritics(val)))
    return 'prawie';

  return 'zle';
}
