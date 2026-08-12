import { zbudujSesje, policzStreak } from '../src/scripts/plan-sesji.js';

let ok = 0, zle = 0;
const t = (nazwa, war) => { war ? ok++ : (zle++, console.log('  FAIL:', nazwa)); };

// --- fixtures -------------------------------------------------------------

// L(2, { quiz: null }) — lekcja nr 2 bez quizu, reszta pol domyslna
const L = (n, nadpisz = {}) => ({
  id: `l${n}`,
  numer: n,
  tytul: `Lekcja ${n}`,
  emoji: '📘',
  maCwiczenia: true,
  maPisanie: true,
  quiz: `0${n}-temat`,
  ...nadpisz,
});

const LEKCJE = [L(1), L(2), L(3)];
const SLOWA = [{ id: 'w1', pl: 'dom' }, { id: 'w2', pl: 'kot' }];

const rodzaje = (r) => r.bloki.map((b) => b.rodzaj);
const blok = (r, rodzaj) => r.bloki.find((b) => b.rodzaj === rodzaj);
const suma = (r) => r.bloki.reduce((s, b) => s + b.minuty, 0);

// --- zbudujSesje: pelna sesja ---------------------------------------------

const pelna = zbudujSesje({
  slowaDoPowtorki: SLOWA, lekcje: LEKCJE, ostatniaLekcja: null,
});

t('pelna: 4 bloki', pelna.bloki.length === 4);
t('pelna: kolejnosc blokow',
  JSON.stringify(rodzaje(pelna)) === JSON.stringify(['slowka', 'gramatyka', 'quiz', 'pisanie']));
t('pelna: 40 minut razem', pelna.minutyRazem === 40);
t('pelna: minutyRazem = suma blokow', pelna.minutyRazem === suma(pelna));
t('pelna: slowka 5 min', blok(pelna, 'slowka').minuty === 5);
t('pelna: gramatyka 12 min', blok(pelna, 'gramatyka').minuty === 12);
t('pelna: quiz 13 min', blok(pelna, 'quiz').minuty === 13);
t('pelna: pisanie 10 min', blok(pelna, 'pisanie').minuty === 10);
t('pelna: slowka niesie slowa', blok(pelna, 'slowka').dane.slowa.length === 2);
t('pelna: gramatyka niesie lekcje', blok(pelna, 'gramatyka').dane.lekcja.id === 'l1');
t('pelna: quiz z tej samej lekcji', blok(pelna, 'quiz').dane.lekcja.id === 'l1');
t('pelna: quiz niesie id quizu', blok(pelna, 'quiz').dane.quiz === '01-temat');
t('pelna: pisanie z tej samej lekcji', blok(pelna, 'pisanie').dane.lekcja.id === 'l1');
t('pelna: kazdy blok ma tytul',
  pelna.bloki.every((b) => typeof b.tytul === 'string' && b.tytul.length > 0));

// --- limit 20 slowek ------------------------------------------------------

const duzoSlow = Array.from({ length: 37 }, (_, i) => ({ id: `w${i}` }));
const zLimitem = zbudujSesje({
  slowaDoPowtorki: duzoSlow, lekcje: LEKCJE, ostatniaLekcja: null,
});
t('limit: max 20 slowek', blok(zLimitem, 'slowka').dane.slowa.length === 20);
t('limit: pierwsze 20, nie losowe', blok(zLimitem, 'slowka').dane.slowa[0].id === 'w0');
t('limit: nadal 40 minut', zLimitem.minutyRazem === 40);

// --- brak slowek: 5 minut idzie do gramatyki ------------------------------

const bezSlow = zbudujSesje({
  slowaDoPowtorki: [], lekcje: LEKCJE, ostatniaLekcja: null,
});
t('bez slow: 3 bloki', bezSlow.bloki.length === 3);
t('bez slow: brak bloku slowka', blok(bezSlow, 'slowka') === undefined);
t('bez slow: gramatyka 17 min', blok(bezSlow, 'gramatyka').minuty === 17);
t('bez slow: nadal 40 minut', bezSlow.minutyRazem === 40);

// --- rotacja lekcji -------------------------------------------------------

const s1 = zbudujSesje({ slowaDoPowtorki: SLOWA, lekcje: LEKCJE, ostatniaLekcja: null });
const g1 = blok(s1, 'gramatyka').dane.lekcja.id;
const s2 = zbudujSesje({ slowaDoPowtorki: SLOWA, lekcje: LEKCJE, ostatniaLekcja: g1 });
const g2 = blok(s2, 'gramatyka').dane.lekcja.id;
const s3 = zbudujSesje({ slowaDoPowtorki: SLOWA, lekcje: LEKCJE, ostatniaLekcja: g2 });
const g3 = blok(s3, 'gramatyka').dane.lekcja.id;

t('rotacja: trzy rozne lekcje pod rzad', new Set([g1, g2, g3]).size === 3);
t('rotacja: idzie w kolejnosci kursu', g1 === 'l1' && g2 === 'l2' && g3 === 'l3');

const s4 = zbudujSesje({ slowaDoPowtorki: SLOWA, lekcje: LEKCJE, ostatniaLekcja: g3 });
t('rotacja: zawija na koncu kursu', blok(s4, 'gramatyka').dane.lekcja.id === 'l1');

t('rotacja: nieznana ostatniaLekcja -> pierwsza lekcja', (() => {
  const r = zbudujSesje({ slowaDoPowtorki: SLOWA, lekcje: LEKCJE, ostatniaLekcja: 'nie-ma-takiej' });
  return blok(r, 'gramatyka').dane.lekcja.id === 'l1';
})());

t('rotacja: pomija lekcje bez cwiczen', (() => {
  const lekcje = [L(1), L(2, { maCwiczenia: false }), L(3)];
  const r = zbudujSesje({ slowaDoPowtorki: SLOWA, lekcje, ostatniaLekcja: 'l1' });
  return blok(r, 'gramatyka').dane.lekcja.id === 'l3';
})());

t('rotacja: pierwsza z cwiczeniami gdy null', (() => {
  const lekcje = [L(1, { maCwiczenia: false }), L(2), L(3)];
  const r = zbudujSesje({ slowaDoPowtorki: SLOWA, lekcje, ostatniaLekcja: null });
  return blok(r, 'gramatyka').dane.lekcja.id === 'l2';
})());

t('rotacja: jedyna lekcja z cwiczeniami powtarza sie', (() => {
  const lekcje = [L(1, { maCwiczenia: false }), L(2), L(3, { maCwiczenia: false })];
  const r = zbudujSesje({ slowaDoPowtorki: SLOWA, lekcje, ostatniaLekcja: 'l2' });
  return blok(r, 'gramatyka').dane.lekcja.id === 'l2';
})());

// --- lekcja bez quizu -----------------------------------------------------

const bezQuizu = zbudujSesje({
  slowaDoPowtorki: SLOWA,
  lekcje: [L(1, { quiz: null }), L(2), L(3)],
  ostatniaLekcja: null,
});
t('bez quizu: 3 bloki', bezQuizu.bloki.length === 3);
t('bez quizu: brak bloku quiz', blok(bezQuizu, 'quiz') === undefined);
t('bez quizu: gramatyka 12+13=25', blok(bezQuizu, 'gramatyka').minuty === 25);
t('bez quizu: nadal 40 minut', bezQuizu.minutyRazem === 40);

// --- pisanie z wczesniejszej lekcji ---------------------------------------

const pisanieWstecz = zbudujSesje({
  slowaDoPowtorki: SLOWA,
  lekcje: [L(1), L(2, { maPisanie: false }), L(3, { maPisanie: false })],
  ostatniaLekcja: 'l2',
});
t('pisanie wstecz: gramatyka z l3', blok(pisanieWstecz, 'gramatyka').dane.lekcja.id === 'l3');
t('pisanie wstecz: pisanie z l1', blok(pisanieWstecz, 'pisanie').dane.lekcja.id === 'l1');
t('pisanie wstecz: 4 bloki i 40 minut',
  pisanieWstecz.bloki.length === 4 && pisanieWstecz.minutyRazem === 40);

// kluczowy test kierunku: pisanie jest i przed, i za lekcja — musi paść wybór wstecz
t('pisanie: wstecz, nie w przod', (() => {
  const lekcje = [L(1), L(2, { maPisanie: false }), L(3)];
  const r = zbudujSesje({ slowaDoPowtorki: SLOWA, lekcje, ostatniaLekcja: 'l1' });
  return blok(r, 'gramatyka').dane.lekcja.id === 'l2'
    && blok(r, 'pisanie').dane.lekcja.id === 'l1';
})());

t('pisanie: szuka wstecz z zawijaniem', (() => {
  const lekcje = [L(1, { maPisanie: false }), L(2, { maPisanie: false }), L(3)];
  const r = zbudujSesje({ slowaDoPowtorki: SLOWA, lekcje, ostatniaLekcja: 'l3' });
  // gramatyka zawija na l1; najblizsze pisanie wstecz od l1 to l3 (przez zawijanie)
  return blok(r, 'gramatyka').dane.lekcja.id === 'l1'
    && blok(r, 'pisanie').dane.lekcja.id === 'l3';
})());

// --- nigdzie nie ma pisania -----------------------------------------------

const bezPisania = zbudujSesje({
  slowaDoPowtorki: SLOWA,
  lekcje: LEKCJE.map((l) => ({ ...l, maPisanie: false })),
  ostatniaLekcja: null,
});
t('bez pisania: 3 bloki', bezPisania.bloki.length === 3);
t('bez pisania: brak bloku pisanie', blok(bezPisania, 'pisanie') === undefined);
t('bez pisania: gramatyka 12+10=22', blok(bezPisania, 'gramatyka').minuty === 22);
t('bez pisania: nadal 40 minut', bezPisania.minutyRazem === 40);

// --- wszystko odpada oprocz gramatyki -------------------------------------

const samaGramatyka = zbudujSesje({
  slowaDoPowtorki: [],
  lekcje: [L(1, { quiz: null, maPisanie: false })],
  ostatniaLekcja: null,
});
t('sama gramatyka: 1 blok', samaGramatyka.bloki.length === 1);
t('sama gramatyka: 40 minut', blok(samaGramatyka, 'gramatyka').minuty === 40);
t('sama gramatyka: minutyRazem 40', samaGramatyka.minutyRazem === 40);

// --- wejscie zdegenerowane ------------------------------------------------

t('puste lekcje: pusty wynik, bez wyjatku', (() => {
  const r = zbudujSesje({ slowaDoPowtorki: [], lekcje: [], ostatniaLekcja: null });
  return r.bloki.length === 0 && r.minutyRazem === 0;
})());

t('puste lekcje mimo slowek: pusty wynik', (() => {
  const r = zbudujSesje({ slowaDoPowtorki: SLOWA, lekcje: [], ostatniaLekcja: null });
  return r.bloki.length === 0 && r.minutyRazem === 0;
})());

t('lekcje bez cwiczen: brak gramatyki, bez wyjatku', (() => {
  const lekcje = LEKCJE.map((l) => ({ ...l, maCwiczenia: false }));
  const r = zbudujSesje({ slowaDoPowtorki: SLOWA, lekcje, ostatniaLekcja: null });
  // bez lekcji-kotwicy nie ma z czego zlozyc gramatyki, quizu ani pisania;
  // powtorka slowek jest samodzielna, wiec zostaje
  return blok(r, 'gramatyka') === undefined
    && blok(r, 'quiz') === undefined
    && blok(r, 'pisanie') === undefined
    && r.bloki.length === 1
    && r.minutyRazem === 5;
})());

t('lekcje bez cwiczen i bez slowek: pusty wynik', (() => {
  const lekcje = LEKCJE.map((l) => ({ ...l, maCwiczenia: false }));
  const r = zbudujSesje({ slowaDoPowtorki: [], lekcje, ostatniaLekcja: null });
  return r.bloki.length === 0 && r.minutyRazem === 0;
})());

t('brakujace argumenty: bez wyjatku', (() => {
  const r = zbudujSesje({});
  return r.bloki.length === 0 && r.minutyRazem === 0;
})());

t('wynik nie wskazuje na wejsciowa tablice slowek', (() => {
  const wejscie = [{ id: 'a' }, { id: 'b' }];
  const r = zbudujSesje({ slowaDoPowtorki: wejscie, lekcje: LEKCJE, ostatniaLekcja: null });
  return blok(r, 'slowka').dane.slowa !== wejscie;
})());

// --- policzStreak ---------------------------------------------------------

t('streak: pusta lista -> 0', policzStreak([], '2026-08-12') === 0);
t('streak: tylko dzis -> 1', policzStreak(['2026-08-12'], '2026-08-12') === 1);
t('streak: dzis + wczoraj -> 2',
  policzStreak(['2026-08-12', '2026-08-11'], '2026-08-12') === 2);
t('streak: trzy dni pod rzad -> 3',
  policzStreak(['2026-08-10', '2026-08-11', '2026-08-12'], '2026-08-12') === 3);
t('streak: dziura w srodku ucina',
  policzStreak(['2026-08-12', '2026-08-10', '2026-08-09'], '2026-08-12') === 1);
t('streak: ostatnia sesja 2 dni temu -> 0',
  policzStreak(['2026-08-09', '2026-08-10'], '2026-08-12') === 0);
t('streak: ostatnia sesja wczoraj -> seria zyje',
  policzStreak(['2026-08-10', '2026-08-11'], '2026-08-12') === 2);
t('streak: wczoraj pojedynczo -> 1',
  policzStreak(['2026-08-11'], '2026-08-12') === 1);
t('streak: duplikaty jednego dnia licza sie raz',
  policzStreak(['2026-08-12', '2026-08-12', '2026-08-11'], '2026-08-12') === 2);
t('streak: same duplikaty dzisiaj -> 1',
  policzStreak(['2026-08-12', '2026-08-12', '2026-08-12'], '2026-08-12') === 1);
t('streak: kolejnosc wejscia bez znaczenia',
  policzStreak(['2026-08-11', '2026-08-12', '2026-08-10'], '2026-08-12') === 3);
t('streak: stara data -> 0', policzStreak(['2025-01-01'], '2026-08-12') === 0);
t('streak: data z przyszlosci nie psuje serii',
  policzStreak(['2026-08-20', '2026-08-12', '2026-08-11'], '2026-08-12') === 2);
t('streak: przelom miesiaca',
  policzStreak(['2026-07-31', '2026-08-01', '2026-08-02'], '2026-08-02') === 3);
t('streak: rok przestepny — 29 lutego',
  policzStreak(['2028-02-28', '2028-02-29', '2028-03-01'], '2028-03-01') === 3);
t('streak: przelom roku',
  policzStreak(['2025-12-31', '2026-01-01'], '2026-01-01') === 2);
t('streak: zmiana czasu (ostatnia niedziela marca) nie gubi dnia',
  policzStreak(['2026-03-28', '2026-03-29', '2026-03-30'], '2026-03-30') === 3);
t('streak: zmiana czasu jesienna nie dubluje dnia',
  policzStreak(['2026-10-24', '2026-10-25', '2026-10-26'], '2026-10-26') === 3);
t('streak: smiec w danych nie wywala', policzStreak(['nie-data', '2026-08-12'], '2026-08-12') === 1);
t('streak: brak listy -> 0', policzStreak(undefined, '2026-08-12') === 0);
t('streak: brak dzis -> 0', policzStreak(['2026-08-12'], undefined) === 0);
t('streak: dluga seria 10 dni', (() => {
  const daty = Array.from({ length: 10 }, (_, i) => `2026-08-${String(3 + i).padStart(2, '0')}`);
  return policzStreak(daty, '2026-08-12') === 10;
})());

console.log(`\n${ok} przeszlo, ${zle} nie przeszlo`);
process.exit(zle ? 1 : 0);
