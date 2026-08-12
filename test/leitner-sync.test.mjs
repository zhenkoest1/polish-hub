import { isDeepStrictEqual } from 'node:util';
import { polacz } from '../src/scripts/leitner-sync.js';

let ok = 0, zle = 0;
const t = (nazwa, war) => { war ? ok++ : (zle++, console.log('  FAIL:', nazwa)); };
const rowne = (a, b) => isDeepStrictEqual(a, b);

const w = (pudelko, termin, widziane) => ({ pudelko, termin, widziane });

// --- przypadki puste ---
t('pusty + pusty = pusty', rowne(polacz({}, {}), {}));

const jeden = { kot: w(2, 1000, 3) };
t('pusty lokalny bierze zdalny', rowne(polacz({}, jeden), jeden));
t('pusty zdalny zostawia lokalny', rowne(polacz(jeden, {}), jeden));

// --- rozlaczne id: suma obu stron ---
const a = { kot: w(2, 1000, 3) };
const b = { pies: w(1, 500, 1) };
t('rozlaczne id sie sumuja', rowne(polacz(a, b), { kot: w(2, 1000, 3), pies: w(1, 500, 1) }));
t('rozlaczne id — dwa wpisy', Object.keys(polacz(a, b)).length === 2);

// --- konflikt rozstrzyga widziane ---
const malo = { kot: w(1, 9999, 2) };
const duzo = { kot: w(4, 100, 7) };
t('wiecej powtorek wygrywa (zdalny)', rowne(polacz(malo, duzo), duzo));
t('wiecej powtorek wygrywa (lokalny)', rowne(polacz(duzo, malo), duzo));

// --- remis na powtorkach: decyduje pozniejszy termin ---
const wczesny = { kot: w(1, 1000, 5) };
const pozny = { kot: w(3, 2000, 5) };
t('remis powtorek -> pozniejszy termin (zdalny)', rowne(polacz(wczesny, pozny), pozny));
t('remis powtorek -> pozniejszy termin (lokalny)', rowne(polacz(pozny, wczesny), pozny));
t('widziane wazniejsze niz termin', rowne(polacz({ kot: w(1, 9e12, 1) }, { kot: w(5, 0, 9) }), { kot: w(5, 0, 9) }));

// --- brak widziane liczy sie jako 0 ---
const bezPola = { kot: { pudelko: 5, termin: 3000 } };
const zJedna = { kot: w(1, 100, 1) };
t('brak widziane = 0, przegrywa z 1', rowne(polacz(bezPola, zJedna), zJedna));
t('brak widziane = 0, przegrywa z 1 (odwrotnie)', rowne(polacz(zJedna, bezPola), zJedna));
t('oba bez widziane -> decyduje termin', rowne(
  polacz({ kot: { pudelko: 1, termin: 100 } }, { kot: { pudelko: 2, termin: 900 } }),
  { kot: { pudelko: 2, termin: 900 } },
));
t('brak widziane nie daje NaN', !Object.values(polacz(bezPola, {})).some((s) => Number.isNaN(s.widziane)));

// --- pelny remis: wygrywa lokalny (deterministycznie) ---
const lokRemis = { kot: w(2, 500, 4) };
const zdalRemis = { kot: w(5, 500, 4) };
t('pelny remis -> lokalny', rowne(polacz(lokRemis, zdalRemis), lokRemis));

// --- brak mutacji wejsc ---
const lokal = { kot: w(1, 100, 1), pies: w(2, 200, 2) };
const zdalny = { kot: w(4, 400, 8), ryba: w(3, 300, 3) };
const kopiaL = structuredClone(lokal);
const kopiaZ = structuredClone(zdalny);
const wynik = polacz(lokal, zdalny);
t('nie mutuje lokalnego', rowne(lokal, kopiaL));
t('nie mutuje zdalnego', rowne(zdalny, kopiaZ));
wynik.kot.pudelko = 99;
wynik.nowe = w(1, 1, 1);
t('wynik odciety od wejsc', rowne(lokal, kopiaL) && rowne(zdalny, kopiaZ));

// --- idempotencja: polacz(a, polacz(a,b)) == polacz(a,b) ---
const raz = polacz(lokal, zdalny);
t('idempotencja', rowne(polacz(lokal, raz), raz));
t('idempotencja (drugie zlozenie)', rowne(polacz(raz, raz), raz));

// --- przemiennosc tam, gdzie nie ma pelnego remisu ---
t('przemiennosc', rowne(polacz(lokal, zdalny), polacz(zdalny, lokal)));
t('przemiennosc na rozlacznych', rowne(polacz(a, b), polacz(b, a)));
t('przemiennosc przy remisie powtorek', rowne(polacz(wczesny, pozny), polacz(pozny, wczesny)));

// --- wejscia nietypowe nie wywalaja funkcji ---
t('undefined jak pusty', rowne(polacz(undefined, jeden), jeden) && rowne(polacz(jeden, undefined), jeden));

console.log(`\n${ok} przeszlo, ${zle} nie przeszlo`);
process.exit(zle ? 1 : 0);
