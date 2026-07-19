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
  }),
});

export const collections = { lekcje, reguly };
