import { stripDiacritics, norm } from '../src/scripts/tekst.js';

let ok = 0, zle = 0;
const t = (nazwa, war) => { war ? ok++ : (zle++, console.log('  FAIL:', nazwa)); };

t('diakrytyki -> ascii', stripDiacritics('ąćęłńóśżź') === 'acelnoszz');
t('strip lowercases', stripDiacritics('ŻÓŁW') === 'zolw');
t('strip idempotentne', stripDiacritics(stripDiacritics('książka')) === stripDiacritics('książka'));
t('strip pusty', stripDiacritics('') === '');
t('norm trim + case + spacje', norm('  Ala  MA kota ') === 'ala ma kota');
t('norm pusty', norm('') === '');
t('norm pojedyncze slowo', norm('Kot') === 'kot');

console.log(`\n${ok} przeszlo, ${zle} nie przeszlo`);
process.exit(zle ? 1 : 0);
