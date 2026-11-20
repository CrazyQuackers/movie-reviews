import { z } from 'zod';

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

export const idParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id'),
});

/** Query string values arrive as strings, hence coerce. */
export const listMoviesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateMovieInput = z.infer<typeof createMovieSchema>;
export type UpdateMovieInput = z.infer<typeof updateMovieSchema>;
export type ListMoviesQuery = z.infer<typeof listMoviesQuerySchema>;
