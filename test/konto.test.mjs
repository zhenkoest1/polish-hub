import { OSOBY, emailOsoby, pinNaHaslo, poprawnyPin, osobaZeSluga } from '../src/scripts/konto.js';

let ok = 0, zle = 0;
const t = (nazwa, war) => { war ? ok++ : (zle++, console.log('  FAIL:', nazwa)); };

// trzy osoby, unikalne slugi
t('trzy osoby', OSOBY.length === 3);
t('slugi unikalne', new Set(OSOBY.map((o) => o.slug)).size === 3);
t('kazda osoba ma emoji i imie', OSOBY.every((o) => o.slug && o.name && o.emoji));

// email deterministyczny i poprawny skladniowo
t('email format', emailOsoby('zenia') === 'zenia@polskiklub.local');
t('email rozny dla osob', emailOsoby('oleg') !== emailOsoby('lena'));

// haslo: deterministyczne, >= 6 znakow (wymog Firebase), zalezne od sluga i pinu
t('haslo deterministyczne', pinNaHaslo('zenia', '1234') === pinNaHaslo('zenia', '1234'));
t('haslo >= 6 znakow', pinNaHaslo('oleg', '0000').length >= 6);
t('haslo zalezy od pinu', pinNaHaslo('zenia', '1234') !== pinNaHaslo('zenia', '4321'));
t('haslo zalezy od sluga', pinNaHaslo('zenia', '1234') !== pinNaHaslo('oleg', '1234'));

// walidacja PIN: dokladnie 4 cyfry
t('pin 4 cyfry ok', poprawnyPin('0421'));
t('pin litery zle', !poprawnyPin('12ab'));
t('pin 3 cyfry zle', !poprawnyPin('123'));
t('pin 5 cyfr zle', !poprawnyPin('12345'));
t('pin pusty zle', !poprawnyPin(''));

// wyszukiwanie osoby
t('osoba po slugu', osobaZeSluga('lena').name === 'Lena');
t('nieznany slug -> undefined', osobaZeSluga('obcy') === undefined);

console.log(`\n${ok} przeszlo, ${zle} nie przeszlo`);
process.exit(zle ? 1 : 0);
