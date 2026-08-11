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
