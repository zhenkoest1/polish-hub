import { wczytajStan, oceń, zbudujKolejke, statystyki, stanSlowa, odpowiedzPoprawna, MAX_PUDELKO } from '../src/scripts/flashcards.js';

// localStorage-shim, bo silnik działa normalnie w przeglądarce
const mem = {};
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = v; },
  removeItem: (k) => { delete mem[k]; },
};

const DZIEN = 864e5;
const slowa = Array.from({ length: 10 }, (_, i) => ({ id: `w${i}` }));
let ok = 0, zle = 0;
const t = (nazwa, war) => { war ? ok++ : (zle++, console.log('  FAIL:', nazwa)); };

let stan = wczytajStan();
t('pusty stan', Object.keys(stan).length === 0);

// wszystkie nowe → wszystkie w kolejce
t('nowe trafiaja do kolejki', zbudujKolejke(slowa, stan, 20).length === 10);
t('limit dziala', zbudujKolejke(slowa, stan, 3).length === 3);

let s0 = statystyki(slowa, stan);
t('start: 10 nowych', s0.nowe === 10 && s0.umiane === 0 && s0.doNauki === 10);

// "wiem" → pudelko 1, termin jutro
const teraz = Date.now();
oceń(stan, 'w0', 'wiem', teraz);
t('wiem -> pudelko 1', stanSlowa(stan, 'w0').pudelko === 1);
t('wiem -> termin za 1 dzien', Math.abs(stanSlowa(stan, 'w0').termin - (teraz + DZIEN)) < 1000);
t('nie wraca dzis', !zbudujKolejke(slowa, stan, 20, teraz).some((s) => s.id === 'w0'));
t('wraca jutro', zbudujKolejke(slowa, stan, 20, teraz + DZIEN + 1).some((s) => s.id === 'w0'));

// wspinaczka do pudelka 5
let ter = teraz;
for (let i = 0; i < 4; i++) { ter += 40 * DZIEN; oceń(stan, 'w0', 'wiem', ter); }
t('5x wiem -> pudelko 5', stanSlowa(stan, 'w0').pudelko === MAX_PUDELKO);
t('pudelko 5 = umiane', statystyki(slowa, stan, ter).umiane === 1);
t('umiane nie w kolejce', !zbudujKolejke(slowa, stan, 20, ter).some((s) => s.id === 'w0'));
t('umiane wraca po 21 dniach', zbudujKolejke(slowa, stan, 20, ter + 22 * DZIEN).some((s) => s.id === 'w0'));

// spojnosc: doNauki musi odpowiadac dlugosci kolejki
const poz = ter + 22 * DZIEN;
const st2 = statystyki(slowa, stan, poz);
t('doNauki == kolejka', st2.doNauki === zbudujKolejke(slowa, stan, 999, poz).length);

// "nie wiem" cofa na start
oceń(stan, 'w0', 'nie-wiem', poz);
t('nie-wiem -> pudelko 1', stanSlowa(stan, 'w0').pudelko === 1);

// "prawie" nie cofa, ale i nie awansuje
oceń(stan, 'w1', 'wiem', poz);
oceń(stan, 'w1', 'prawie', poz);
t('prawie zostawia pudelko', stanSlowa(stan, 'w1').pudelko === 1);

// zaleglosci maja pierwszenstwo przed nowymi
const kol = zbudujKolejke(slowa, stan, 3, poz + 2 * DZIEN);
t('zaleglosci pierwsze', kol[0].id === 'w0' || kol[0].id === 'w1');

// porownanie odpowiedzi bez ogonkow
t('bez ogonkow', odpowiedzPoprawna('zolw', 'żółw') && odpowiedzPoprawna(' MIASTO ', 'miasto'));
t('rozne slowa != rowne', !odpowiedzPoprawna('kot', 'pies'));

// zepsuty localStorage nie wywala silnika
mem['pk_slowka_v1'] = '{niepoprawny';
t('zepsuty JSON -> pusty stan', Object.keys(wczytajStan()).length === 0);

console.log(`\n${ok} przeszlo, ${zle} nie przeszlo`);
process.exit(zle ? 1 : 0);
