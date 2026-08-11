// Konta trzech osob. Zadnych sekretow: PIN zna tylko wlasciciel,
// a serwer (Firebase Auth) sprawdza haslo wyprowadzone z PIN-u.
export const OSOBY = [
  { slug: 'oleg', name: 'Oleg', emoji: '🦅' },
  { slug: 'lena', name: 'Lena', emoji: '🌸' },
  { slug: 'zenia', name: 'Żenia', emoji: '🐺' },
];

export function osobaZeSluga(slug) {
  return OSOBY.find((o) => o.slug === slug);
}

// Email jest sluzbowy — nikt na niego nie pisze, to tylko identyfikator w Auth.
export function emailOsoby(slug) {
  return `${slug}@polskiklub.local`;
}

// Firebase wymaga hasla >= 6 znakow; PIN ma 4 — doklejamy stale czesci.
// To NIE jest kryptografia (kod jest publiczny) — ochrona w tym, ze haslo
// sprawdza serwer, wiec bez PIN-u nie zapiszesz sie jako inna osoba.
export function pinNaHaslo(slug, pin) {
  return `PK-${slug}-${pin}-gora`;
}

export function poprawnyPin(pin) {
  return /^\d{4}$/.test(pin);
}
