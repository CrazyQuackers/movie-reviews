import { z } from 'zod';
import { idParamSchema, paginationSchema } from './common';

export const MIN_RATING = 1;
export const MAX_RATING = 10;
export const MAX_REVIEW_TEXT_LENGTH = 2000;

export const createReviewSchema = z.object({
  rating: z.number().int().min(MIN_RATING).max(MAX_RATING),
  text: z.string().trim().min(1).max(MAX_REVIEW_TEXT_LENGTH),
});

/** PUT: only `rating` and `text` are editable (unknown fields such as `movie` are stripped); at least one. */
export const updateReviewSchema = createReviewSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'Provide at least one field to update' });

/** `/movies/:movieId/reviews` path parameter. */
export const movieIdParamSchema = z.object({ movieId: idParamSchema.shape.id });

export const listReviewsQuerySchema = paginationSchema;

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type ListReviewsQuery = z.infer<typeof listReviewsQuerySchema>;
