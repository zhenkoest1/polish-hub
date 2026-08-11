// Czysta logika wynikow — bez Firebase, testowalna w node.

export function procent(got, max) {
  return max ? Math.round((got / max) * 100) : 0;
}

// Najlepszy wynik dla quizu: wyzszy procent wygrywa, remis nie nadpisuje
// (szanujemy starszy rekord — "pierwszy raz zdobyte").
export function lepszyWynik(stary, nowy) {
  if (!stary) return nowy;
  return nowy.pct > stary.pct ? nowy : stary;
}
