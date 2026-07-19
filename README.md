# 🇵🇱 Polski Klub

Strona kursu polskiego dla trzech przyjaciół: **Oleg · Lena · Żenia**. A2 → B1.

**Live:** https://zhenkoest1.github.io/polish-hub/

## Struktura

```
src/
  content/lekcje/     # lekcje w Markdown (tekst, reguła, słowa, ćwiczenia ustne)
  data/quizzes/       # dane quizów w JSON (tf, mc, typein, tap_fill)
  scripts/quiz-engine.js  # silnik quizów (vanilla JS)
  styles/quiz.css     # style quizów
  layouts/Base.astro  # wspólny layout (design: Polska Szkoła Plakatu)
  pages/              # strona główna + strony lekcji
```

## Jak dodać nową lekcję

1. Utwórz `src/content/lekcje/NN-nazwa.md` z frontmatterem:
   `numer`, `tytul`, `emoji`, `gramatyka`, `data`, `opis`, `quiz` (id JSON-a)
2. Utwórz `src/data/quizzes/NN-nazwa.json` — sekcje z pytaniami
3. Push na `main` → GitHub Actions buduje i deployuje automatycznie

## Typy pytań w quizie

| Typ | Opis |
|---|---|
| `tf` | Prawda / Fałsz |
| `mc` | Wybór odpowiedzi |
| `typein` | Wpisywanie (wykrywa „prawie dobrze" bez polskich znaków) |
| `tap_fill` | Słowa do luk w tekście (tap-to-place, działa na telefonie) |

## Dev

```bash
npm install
npm run dev      # http://localhost:4321/polish-hub/
npm run build
```
