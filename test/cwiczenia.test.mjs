import { parsujCwiczenie, sprawdzWybor, sprawdzWpisz } from '../src/scripts/cwiczenia-logika.js';

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
t('sprawdzWpisz: multi answer prawie', sprawdzWpisz({ odpowiedz: ['biologowie'] }, 'biologowie') === 'dobrze');

// sprawdzWpisz — empty input
t('sprawdzWpisz: empty input', sprawdzWpisz({ odpowiedz: ['test'] }, '') === 'zle');
t('sprawdzWpisz: only spaces', sprawdzWpisz({ odpowiedz: ['test'] }, '   ') === 'zle');

console.log(`\n${ok} przeszlo, ${zle} nie przeszlo`);
process.exit(zle ? 1 : 0);
