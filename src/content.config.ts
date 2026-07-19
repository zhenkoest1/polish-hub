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

export const collections = { lekcje };
