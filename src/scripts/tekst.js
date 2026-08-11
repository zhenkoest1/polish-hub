// Wspolne narzedzia tekstowe — uzywane przez quiz-engine i silnik cwiczen.

export function stripDiacritics(s) {
  return s
    .toLowerCase()
    .replaceAll('ą', 'a').replaceAll('ć', 'c').replaceAll('ę', 'e')
    .replaceAll('ł', 'l').replaceAll('ń', 'n').replaceAll('ó', 'o')
    .replaceAll('ś', 's').replaceAll('ż', 'z').replaceAll('ź', 'z');
}

export function norm(s) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}
