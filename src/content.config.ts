import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const reviews = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/reviews' }),
  schema: z.object({
    author: z.string(),
    rating: z.number().int().min(1).max(5),
    text: z.string(),
    date: z.coerce.date(),
    avatarUrl: z.string().trim().toLowerCase().url().or(z.literal('')).transform(val => val === '' ? undefined : val).optional(),
    source: z.string().default('Google'),
    videoUrl: z.string().optional(),
  }),
});

const decks = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/decks' }),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    image: z.string(),
  }),
});

export const collections = { reviews, decks };
