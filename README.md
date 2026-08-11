# 🇵🇱 Polski Klub

Strona kursu polskiego dla trzech przyjaciół: **Oleg · Lena · Żenia**. A2 → B1.

**Live:** https://zhenkoest1.github.io/polish-hub/

Strona jest publiczna, ale zamknięta dla wyszukiwarek (`robots.txt` + `noindex`) — kurs jest prywatny, choć nie chroniony hasłem.

## Cztery działy

| Dział | Co to jest |
|---|---|
| **Lekcje** | tekst do czytania na głos, reguła, słowa, ćwiczenia ustne na spotkanie |
| **Reguły** | ściągi gramatyczne po rosyjsku — przypadki, czasownik, reszta |
| **Słówka** | fiszki z powtórkami rozłożonymi w czasie (system Leitnera) |
| **Quizy** | quiz do każdej lekcji + zbiorczy „Wielki Mix" |

## Struktura

```
src/
  content/lekcje/       # lekcje w Markdown — PO POLSKU
  content/reguly/       # ściągi gramatyczne — PO ROSYJSKU (inny gatunek!)
  data/quizzes/         # dane quizów w JSON
  data/slowka/          # banki słów, jeden plik na lekcję
  scripts/quiz-engine.js  # silnik quizów (vanilla JS)
  scripts/flashcards.js   # silnik powtórek — Leitner, localStorage
  scripts/confetti.js
  layouts/Base.astro    # wspólny layout (design: Polska Szkoła Plakatu)
  pages/                # strona główna + lekcje / reguły / słówka / quizy
test/                   # npm test — silnik powtórek + walidacja treści
```

## Jak dodać nową lekcję

1. `src/content/lekcje/NN-nazwa.md` — frontmatter: `numer`, `tytul`, `emoji`, `gramatyka`, `data`, `opis`, `quiz`
2. `src/data/quizzes/NN-nazwa.json` — sekcje z pytaniami
3. `src/data/slowka/NN-nazwa.json` — `{lekcja, temat, slowa: [...]}`
4. `npm test && npm run build`, potem push na `main` — GitHub Actions deployuje sam

Strona główna, listy lekcji, reguł i słówek podchwytują nowe pliki same — nie ma nigdzie listy do ręcznej aktualizacji.

## Jak dodać nową regułę

`src/content/reguly/slug.md` z frontmatterem: `tytul`, `emoji`, `kategoria` (`przypadki` / `czasownik` / `inne`), `kolejnosc`, opcjonalnie `lekcja` i `pytania`. Kategoria decyduje o bloku na `/reguly/`, `kolejnosc` o miejscu w bloku.

## Typy pytań w quizie

| Typ | Opis | Kształt pytania |
|---|---|---|
| `tf` | Prawda / Fałsz | `{q, answer: bool}` |
| `mc` | Wybór odpowiedzi | `{q, options[], answer, explain}` |
| `typein` | Wpisywanie (wykrywa „prawie dobrze" bez polskich znaków) | `{q, hint, answer}` |
| `match` | Łączenie w pary (tap lewo → tap prawo) | `{q, pairs: [[a,b], …]}` |
| `tap_fill` | Słowa do luk w tekście (działa na telefonie) | `{text: "… {0} …", answers[]}` |

W `mc` pole `answer` musi być **dokładnie** jedną z `options` — inaczej pytania nie da się zaliczyć, a build i tak przejdzie. Pilnuje tego `npm test`.

## Słówka — jak działa powtarzanie

System Leitnera, 5 pudełek, odstępy **1 / 3 / 7 / 21 dni**. Dobra odpowiedź przesuwa słowo o pudełko w górę, błędna wraca je na początek. Postęp siedzi w `localStorage` (`pk_slowka_v1`) — każdy uczy się na swoim urządzeniu, wspólnego backendu nie ma.

## Dev

```bash
npm install
npm run dev      # http://localhost:4321/polish-hub/
npm test         # silnik powtórek + walidacja lekcji, quizów i słówek
npm run build
```
