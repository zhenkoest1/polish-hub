/**
 * Dwa urzadzenia, jeden uczen: telefon i laptop trzymaja wlasny stan Leitnera.
 * Przy logowaniu trzeba je pogodzic — wygrywa ten, ktory wie wiecej o slowie.
 *
 * "Wie wiecej" = ma wyzsze "widziane" (licznik ocen, ktory silnik i tak
 * prowadzi od poczatku). Przy remisie bierzemy wpis
 * z pozniejszym terminem, bo pozniejszy termin znaczy swiezsza ocena.
 * Czysta funkcja — zadnego localStorage ani Firebase, zeby dalo sie ja
 * przetestowac i zeby konflikt rozstrzygal sie tak samo wszedzie.
 */

/** Stary stan moze nie miec licznika — to zero, nie NaN. */
function ile(wpis) {
  const n = Number(wpis?.widziane);
  return Number.isFinite(n) ? n : 0;
}

function kiedy(wpis) {
  const n = Number(wpis?.termin);
  return Number.isFinite(n) ? n : 0;
}

/** true, gdy zdalny wpis ma pierwszenstwo przed lokalnym (remis = lokalny). */
function zdalnyWygrywa(lokalny, zdalny) {
  const rl = ile(lokalny);
  const rz = ile(zdalny);
  if (rz !== rl) return rz > rl;
  return kiedy(zdalny) > kiedy(lokalny);
}

/**
 * Laczy dwa stany Leitnera w nowy obiekt. Nie rusza wejsc — kopiuje wpisy,
 * zeby pozniejszy zapis wyniku nie wracal rykoszetem do stanu lokalnego.
 */
export function polacz(lokalny, zdalny) {
  const l = lokalny && typeof lokalny === 'object' ? lokalny : {};
  const z = zdalny && typeof zdalny === 'object' ? zdalny : {};
  const wynik = {};

  for (const [id, wpis] of Object.entries(l)) wynik[id] = { ...wpis };
  for (const [id, wpis] of Object.entries(z)) {
    if (!(id in wynik) || zdalnyWygrywa(l[id], wpis)) wynik[id] = { ...wpis };
  }

  return wynik;
}
