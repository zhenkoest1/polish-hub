import { parsujCwiczenie, sprawdzWybor, sprawdzWpisz, sprawdzPare } from '../src/scripts/cwiczenia-logika.js';

let ok = 0, zle = 0;
const t = (nazwa, war) => { war ? ok++ : (zle++, console.log('  FAIL:', nazwa)); };

// parsujCwiczenie — valid cases
t('parsuj: wybor valide', (() => {
  const r = parsujCwiczenie(JSON.stringify({
    typ: 'wybor',
    tytul: 'Test',
    instrukcja: 'Wybierz',
    zdania: [{ przed: 'Wczoraj ', opcje: ['czytać', 'przeczytać'], dobra: 0, po: ' książkę.', czemu: 'test' }]
  }));
  return r.ok === true && r.dane.typ === 'wybor';
})());

t('parsuj: wpisz valide', (() => {
  const r = parsujCwiczenie(JSON.stringify({
    typ: 'wpisz',
    tytul: 'Test',
    instrukcja: 'Wpisz',
    zdania: [{ przed: 'pisać → ', odpowiedz: ['napisać'], po: '', czemu: 'test' }]
  }));
  return r.ok === true && r.dane.typ === 'wpisz';
})());

// parsujCwiczenie — broken JSON
t('parsuj: broken JSON', (() => {
  const r = parsujCwiczenie('{typ');
  return r.ok === false && typeof r.blad === 'string' && r.blad.length > 0;
})());

// parsujCwiczenie — unknown type
t('parsuj: unknown typ', (() => {
  const r = parsujCwiczenie(JSON.stringify({
    typ: 'dyktando',
    tytul: 'Test',
    instrukcja: 'Test',
    zdania: []
  }));
  return r.ok === false && r.blad.includes('nieznany typ');
})());

// parsujCwiczenie — wybor with dobra out of range
t('parsuj: dobra out of range', (() => {
  const r = parsujCwiczenie(JSON.stringify({
    typ: 'wybor',
    tytul: 'Test',
    instrukcja: 'Test',
    zdania: [{ przed: 'a', opcje: ['x', 'y'], dobra: 5, po: 'b', czemu: 'test' }]
  }));
  return r.ok === false && r.blad.includes('dobra');
})());

// parsujCwiczenie — wybor with only 1 option
t('parsuj: tylko 1 opcja', (() => {
  const r = parsujCwiczenie(JSON.stringify({
    typ: 'wybor',
    tytul: 'Test',
    instrukcja: 'Test',
    zdania: [{ przed: 'a', opcje: ['x'], dobra: 0, po: 'b', czemu: 'test' }]
  }));
  return r.ok === false && r.blad.includes('opcje');
})());

// parsujCwiczenie — wpisz with empty odpowiedz
t('parsuj: empty odpowiedz', (() => {
  const r = parsujCwiczenie(JSON.stringify({
    typ: 'wpisz',
    tytul: 'Test',
    instrukcja: 'Test',
    zdania: [{ przed: 'a', odpowiedz: [], po: 'b', czemu: 'test' }]
  }));
  return r.ok === false && r.blad.includes('odpowiedz');
})());

// parsujCwiczenie — zdania missing
t('parsuj: zdania missing', (() => {
  const r = parsujCwiczenie(JSON.stringify({
    typ: 'wpisz',
    tytul: 'Test',
    instrukcja: 'Test'
  }));
  return r.ok === false && r.blad.includes('zdania');
})());

// parsujCwiczenie — zdania empty
t('parsuj: zdania empty', (() => {
  const r = parsujCwiczenie(JSON.stringify({
    typ: 'wpisz',
    tytul: 'Test',
    instrukcja: 'Test',
    zdania: []
  }));
  return r.ok === false && r.blad.includes('zdania');
})());

// parsujCwiczenie — przed not string
t('parsuj: przed not string', (() => {
  const r = parsujCwiczenie(JSON.stringify({
    typ: 'wpisz',
    tytul: 'Test',
    instrukcja: 'Test',
    zdania: [{ przed: 123, odpowiedz: ['x'], po: '', czemu: 'test' }]
  }));
  return r.ok === false && r.blad.includes('przed');
})());

// parsujCwiczenie — po empty string is OK
t('parsuj: po empty string OK', (() => {
  const r = parsujCwiczenie(JSON.stringify({
    typ: 'wpisz',
    tytul: 'Test',
    instrukcja: 'Test',
    zdania: [{ przed: 'a', odpowiedz: ['x'], po: '', czemu: 'test' }]
  }));
  return r.ok === true;
})());

// sprawdzWybor — correct index
t('sprawdzWybor: correct', sprawdzWybor({ dobra: 0 }, 0) === true);
t('sprawdzWybor: wrong', sprawdzWybor({ dobra: 0 }, 1) === false);
t('sprawdzWybor: wrong 2', sprawdzWybor({ dobra: 2 }, 0) === false);

// sprawdzWpisz — exact match
t('sprawdzWpisz: exact match', sprawdzWpisz({ odpowiedz: ['napisać'] }, 'napisać') === 'dobrze');

// sprawdzWpisz — case and spaces
t('sprawdzWpisz: case/spaces', sprawdzWpisz({ odpowiedz: ['napisać'] }, '  NapisAć ') === 'dobrze');

// sprawdzWpisz — missing diacritics -> prawie
t('sprawdzWpisz: missing diacritics', sprawdzWpisz({ odpowiedz: ['napisać'] }, 'napisac') === 'prawie');

// sprawdzWpisz — wrong word
t('sprawdzWpisz: wrong word', sprawdzWpisz({ odpowiedz: ['napisać'] }, 'zrobić') === 'zle');

// sprawdzWpisz — multiple accepted answers, each correct
t('sprawdzWpisz: multi answer 1', sprawdzWpisz({ odpowiedz: ['biolodzy', 'biologowie'] }, 'biolodzy') === 'dobrze');
t('sprawdzWpisz: multi answer 2', sprawdzWpisz({ odpowiedz: ['biolodzy', 'biologowie'] }, 'biologowie') === 'dobrze');

// sprawdzWpisz — prawie with multi-answer (without diacritics)
t('sprawdzWpisz: multi answer prawie (drugi wariant bez ogonkow)', sprawdzWpisz({ odpowiedz: ['policzyć', 'obliczyć'] }, 'obliczyc') === 'prawie');
t('sprawdzWpisz: tytul nie-string -> ok:false', parsujCwiczenie(JSON.stringify({ typ: 'wpisz', tytul: 42, zdania: [{ przed: 'a', po: '', odpowiedz: ['b'] }] })).ok === false);
t('sprawdzWpisz: czemu nie-string -> ok:false', parsujCwiczenie(JSON.stringify({ typ: 'wpisz', zdania: [{ przed: 'a', po: '', odpowiedz: ['b'], czemu: [] }] })).ok === false);

// sprawdzWpisz — empty input
t('sprawdzWpisz: empty input', sprawdzWpisz({ odpowiedz: ['test'] }, '') === 'zle');
t('sprawdzWpisz: only spaces', sprawdzWpisz({ odpowiedz: ['test'] }, '   ') === 'zle');

// dokladnie: pary minimalne (jedz/jedź) — diakrytyk zmienia znaczenie, nie ma "prawie"
t('dokladnie: brak ogonka to blad, nie prawie',
  sprawdzWpisz({ odpowiedz: ['jedź'], dokladnie: true }, 'jedz') === 'zle');
t('dokladnie: poprawna odpowiedz nadal dobrze',
  sprawdzWpisz({ odpowiedz: ['jedź'], dokladnie: true }, 'jedź') === 'dobrze');
t('dokladnie: wielkosc liter i spacje nadal wybaczane',
  sprawdzWpisz({ odpowiedz: ['jedź'], dokladnie: true }, '  Jedź ') === 'dobrze');
t('bez dokladnie: brak ogonka to prawie',
  sprawdzWpisz({ odpowiedz: ['jedź'] }, 'jedz') === 'prawie');
t('dokladnie musi byc boolean',
  parsujCwiczenie(JSON.stringify({ typ: 'wpisz', zdania: [{ przed: 'a', po: '', odpowiedz: ['b'], dokladnie: 'tak' }] })).ok === false);
t('dokladnie: true przechodzi walidacje',
  parsujCwiczenie(JSON.stringify({ typ: 'wpisz', zdania: [{ przed: 'a', po: '', odpowiedz: ['b'], dokladnie: true }] })).ok === true);

// typ "pisanie" — wolny tekst, nie ma czego sprawdzac automatycznie
const PISANIE_OK = JSON.stringify({
  typ: 'pisanie', tytul: 'Mini-pisanie', instrukcja: 'Napisz trzy zdania.',
  zdania: [
    { przed: '1. Co zacząłem i nie skończyłem?', po: '', czemu: 'ndk, czas przeszły' },
    { przed: '2. Kiedy to skończę?', po: '', czemu: 'dk, czas przyszły' },
  ],
});
t('pisanie: poprawny blok', parsujCwiczenie(PISANIE_OK).ok === true);
t('pisanie: typ zachowany', parsujCwiczenie(PISANIE_OK).dane.typ === 'pisanie');
t('pisanie: nie wymaga odpowiedz ani opcje',
  parsujCwiczenie(JSON.stringify({ typ: 'pisanie', zdania: [{ przed: 'Napisz coś', po: '' }] })).ok === true);
t('pisanie: puste zdania -> blad',
  parsujCwiczenie(JSON.stringify({ typ: 'pisanie', zdania: [] })).ok === false);
t('pisanie: przed nie-string -> blad',
  parsujCwiczenie(JSON.stringify({ typ: 'pisanie', zdania: [{ przed: 42, po: '' }] })).ok === false);
t('pisanie: czemu nie-string -> blad',
  parsujCwiczenie(JSON.stringify({ typ: 'pisanie', zdania: [{ przed: 'a', po: '', czemu: 7 }] })).ok === false);

// typ "polacz" — laczenie par w dwoch kolumnach; dane w `pary`, nie w `zdania`
const POLACZ_OK = JSON.stringify({
  typ: 'polacz', tytul: 'Części mowy', instrukcja: 'Połącz nazwę z pytaniem.',
  pary: [
    ['czasownik', 'co robić?'],
    ['rzeczownik', 'kto? co?'],
    ['przymiotnik', 'jaki?'],
  ],
});
t('polacz: poprawny blok', parsujCwiczenie(POLACZ_OK).ok === true);
t('polacz: typ zachowany', parsujCwiczenie(POLACZ_OK).dane.typ === 'polacz');
t('polacz: zdania niepotrzebne', parsujCwiczenie(POLACZ_OK).ok === true);
t('polacz: pary zachowane', parsujCwiczenie(POLACZ_OK).dane.pary.length === 3);

t('polacz: mniej niz 3 pary -> blad', (() => {
  const r = parsujCwiczenie(JSON.stringify({
    typ: 'polacz', pary: [['a', 'b'], ['c', 'd']],
  }));
  return r.ok === false && r.blad.includes('pary');
})());

t('polacz: brak pary -> blad', (() => {
  const r = parsujCwiczenie(JSON.stringify({ typ: 'polacz', tytul: 'Test' }));
  return r.ok === false && r.blad.includes('pary');
})());

t('polacz: para z 1 elementem -> blad', (() => {
  const r = parsujCwiczenie(JSON.stringify({
    typ: 'polacz', pary: [['a', 'b'], ['c', 'd'], ['e']],
  }));
  return r.ok === false && r.blad.includes('para 3');
})());

t('polacz: para z 3 elementami -> blad', (() => {
  const r = parsujCwiczenie(JSON.stringify({
    typ: 'polacz', pary: [['a', 'b', 'x'], ['c', 'd'], ['e', 'f']],
  }));
  return r.ok === false && r.blad.includes('para 1');
})());

t('polacz: pusty string w parze -> blad', (() => {
  const r = parsujCwiczenie(JSON.stringify({
    typ: 'polacz', pary: [['a', 'b'], ['c', ''], ['e', 'f']],
  }));
  return r.ok === false && r.blad.includes('para 2');
})());

t('polacz: same spacje w parze -> blad', (() => {
  const r = parsujCwiczenie(JSON.stringify({
    typ: 'polacz', pary: [['a', 'b'], ['   ', 'd'], ['e', 'f']],
  }));
  return r.ok === false && r.blad.includes('para 2');
})());

t('polacz: element nie-string -> blad', (() => {
  const r = parsujCwiczenie(JSON.stringify({
    typ: 'polacz', pary: [['a', 'b'], ['c', 7], ['e', 'f']],
  }));
  return r.ok === false && r.blad.includes('para 2');
})());

// duplikat po lewej = dwie poprawne odpowiedzi na to samo -> laczenie niejednoznaczne
t('polacz: duplikat lewej strony -> blad', (() => {
  const r = parsujCwiczenie(JSON.stringify({
    typ: 'polacz', pary: [['a', 'b'], ['a', 'd'], ['e', 'f']],
  }));
  return r.ok === false && r.blad.includes('lewe');
})());

t('polacz: duplikat prawej strony przechodzi walidacje', parsujCwiczenie(JSON.stringify({
  typ: 'polacz', pary: [['a', 'x'], ['b', 'x'], ['c', 'y']],
})).ok === true);
// Dwa slowa z tym samym tlumaczeniem: klikniecie w KAZDY z identycznych
// napisow po prawej musi byc poprawne — inaczej uczen zgaduje 50/50.
const DUPL = { pary: [['prawie', 'почти'], ['niemal', 'почти'], ['zawsze', 'всегда']] };
t('polacz: duplikat prawej — para wprost', sprawdzPare(DUPL, 0, 0) === true);
t('polacz: duplikat prawej — drugi identyczny napis tez dobry', sprawdzPare(DUPL, 0, 1) === true);
t('polacz: duplikat prawej — inne tlumaczenie nadal zle', sprawdzPare(DUPL, 0, 2) === false);

t('polacz: tytul nie-string -> blad',
  parsujCwiczenie(JSON.stringify({ typ: 'polacz', tytul: 42, pary: [['a', 'b'], ['c', 'd'], ['e', 'f']] })).ok === false);
t('polacz: instrukcja nie-string -> blad',
  parsujCwiczenie(JSON.stringify({ typ: 'polacz', instrukcja: [], pary: [['a', 'b'], ['c', 'd'], ['e', 'f']] })).ok === false);

// pozostale typy nadal wymagaja `zdania`, a `pary` ich nie ratuja
t('wpisz: pary nie zastepuja zdania',
  parsujCwiczenie(JSON.stringify({ typ: 'wpisz', pary: [['a', 'b'], ['c', 'd'], ['e', 'f']] })).ok === false);
t('wybor: brak zdania nadal blad',
  parsujCwiczenie(JSON.stringify({ typ: 'wybor', tytul: 'T' })).blad.includes('zdania'));
t('pisanie: pary nie sa wymagane',
  parsujCwiczenie(JSON.stringify({ typ: 'pisanie', zdania: [{ przed: 'a', po: '' }] })).ok === true);

// sprawdzPare — te same indeksy oryginalnych par
const PARY = { pary: [['a', 'b'], ['c', 'd'], ['e', 'f']] };
t('sprawdzPare: ta sama para', sprawdzPare(PARY, 0, 0) === true);
t('sprawdzPare: ta sama para (ostatnia)', sprawdzPare(PARY, 2, 2) === true);
t('sprawdzPare: rozne pary', sprawdzPare(PARY, 0, 1) === false);
t('sprawdzPare: indeks poza zakresem', sprawdzPare(PARY, 0, 9) === false);

console.log(`\n${ok} przeszlo, ${zle} nie przeszlo`);
process.exit(zle ? 1 : 0);
