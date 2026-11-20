import { z } from 'zod';
import { paginationSchema } from './common';

export const MIN_RELEASE_YEAR = 1888;
const MAX_YEARS_AHEAD = 5;

const releaseYear = z
  .number()
  .int()
  .min(MIN_RELEASE_YEAR)
  // Evaluated per request so the upper bound moves with the calendar.
  .refine((year) => year <= new Date().getFullYear() + MAX_YEARS_AHEAD, {
    message: `releaseYear must be at most ${MAX_YEARS_AHEAD} years in the future`,
  });

const text = z.string().trim().min(1);

export const createMovieSchema = z.object({
  title: text,
  releaseYear,
  genre: z.array(text).min(1),
  director: text,
  actors: z.array(text).default([]),
  description: z.string().trim().optional(),
});

/** PUT: any subset of the fields, but at least one. */
export const updateMovieSchema = createMovieSchema
  .partial()
  // .partial() keeps the `actors` default, which would silently wipe actors on every update.
  .extend({ actors: z.array(text).optional() })
  .refine((body) => Object.keys(body).length > 0, { message: 'Provide at least one field to update' });

export const MOVIE_SORT_FIELDS = ['title', 'releaseYear', 'createdAt'] as const;
/** `field` sorts ascending, `-field` descending. */
const sortValues = MOVIE_SORT_FIELDS.flatMap((field) => [field, `-${field}` as const]);

export const listMoviesQuerySchema = paginationSchema.extend({
  title: text.optional(), // partial, case-insensitive
  genre: text.optional(), // exact (case-insensitive) match against any of the movie's genres
  year: z.coerce.number().int().optional(),
  director: text.optional(), // exact, case-insensitive
  actor: text.optional(), // exact (case-insensitive) match against any of the movie's actors
  // No default here: the repository falls back to newest first.
  sort: z.enum(sortValues).optional(),
});

export type CreateMovieInput = z.infer<typeof createMovieSchema>;
export type UpdateMovieInput = z.infer<typeof updateMovieSchema>;
export type ListMoviesQuery = z.infer<typeof listMoviesQuerySchema>;
