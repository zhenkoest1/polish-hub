import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const lekcje = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/lekcje' }),
  schema: z.object({
    numer: z.number(),
    tytul: z.string(),
    emoji: z.string(),
    gramatyka: z.string(),
    data: z.string().optional(),
    opis: z.string().optional(),
    quiz: z.string().optional(), // id pliku JSON w src/data/quizzes/
  }),
});

const reguly = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/reguly' }),
  schema: z.object({
    tytul: z.string(),
    emoji: z.string(),
    lekcja: z.number().optional(), // numer lekcji, w której reguła się pojawia
    pytania: z.string().optional(), // np. "kogo? co?"
    // grupowanie na stronie /reguly/ — przypadki / czasownik / inne
    kategoria: z.enum(['przypadki', 'czasownik', 'inne']).default('inne'),
    kolejnosc: z.number().default(99), // kolejność wewnątrz kategorii
  }),
});

// Teksty do czytania — osobna ścieżka niż lekcje: bez gramatyki i bez quizu,
// za to z poziomem trudności (1..5) i licznikiem słów, żeby uczeń widział,
// na co się pisze, zanim kliknie.
const czytanie = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/czytanie' }),
  schema: z.object({
    tytul: z.string(),
    emoji: z.string(),
    poziom: z.number().min(1).max(5),
    slowa: z.number(),
    temat: z.string(),
    opis: z.string().optional(),
  }),
});

export const collections = { lekcje, reguly, czytanie };
