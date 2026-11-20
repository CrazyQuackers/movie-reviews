import { Router } from 'express';
import * as reviewController from '../controllers/reviewController';
import { requireAuth } from '../middlewares/requireAuth';
import { validate } from '../middlewares/validate';
import { idParamSchema } from '../validators/common';
import {
  createReviewSchema,
  listReviewsQuerySchema,
  movieIdParamSchema,
  updateReviewSchema,
} from '../validators/review';

/** Mounted at `/movies/:movieId/reviews`. */
export const movieReviewsRouter = Router({ mergeParams: true });

/** Mounted at `/reviews`. */
const reviewRouter = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     Review:
 *       type: object
 *       properties:
 *         id: { type: string, example: 507f1f77bcf86cd799439013 }
 *         movie: { type: string, description: Id of the reviewed movie, example: 507f1f77bcf86cd799439011 }
 *         createdBy: { type: string, description: Id of the review's author, example: 507f1f77bcf86cd799439012 }
 *         rating: { type: integer, minimum: 1, maximum: 10, example: 8 }
 *         text: { type: string, maxLength: 2000, example: Mind-bending and beautifully shot. }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     ReviewInput:
 *       type: object
 *       required: [rating, text]
 *       properties:
 *         rating: { type: integer, minimum: 1, maximum: 10, example: 8 }
 *         text: { type: string, minLength: 1, maxLength: 2000, example: Mind-bending and beautifully shot. }
 *     ReviewList:
 *       type: object
 *       properties:
 *         data: { type: array, items: { $ref: '#/components/schemas/Review' } }
 *         page: { type: integer, example: 1 }
 *         limit: { type: integer, example: 20 }
 *         total: { type: integer, example: 42 }
 *   parameters:
 *     ReviewMovieId:
 *       name: movieId
 *       in: path
 *       required: true
 *       description: Id of the movie (Mongo ObjectId)
 *       schema: { type: string, example: 507f1f77bcf86cd799439011 }
 *     ReviewId:
 *       name: id
 *       in: path
 *       required: true
 *       description: Review id (Mongo ObjectId)
 *       schema: { type: string, example: 507f1f77bcf86cd799439013 }
 */

/**
 * @openapi
 * /movies/{movieId}/reviews:
 *   get:
 *     tags: [Reviews]
 *     summary: List the reviews of a movie, newest first (public)
 *     parameters:
 *       - $ref: '#/components/parameters/ReviewMovieId'
 *       - { name: page, in: query, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *     responses:
 *       200:
 *         description: A page of reviews
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ReviewList' }
 *       400:
 *         description: Malformed movie id or invalid query parameters
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Movie not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
movieReviewsRouter.get(
  '/',
  validate(movieIdParamSchema, 'params'),
  validate(listReviewsQuerySchema, 'query'),
  reviewController.listForMovie,
);

/**
 * @openapi
 * /movies/{movieId}/reviews:
 *   post:
 *     tags: [Reviews]
 *     summary: Review a movie (one review per user per movie)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/ReviewMovieId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ReviewInput' }
 *     responses:
 *       201:
 *         description: Review created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Review' }
 *       400:
 *         description: Validation error or malformed movie id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Movie not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: You have already reviewed this movie
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
movieReviewsRouter.post(
  '/',
  requireAuth,
  validate(movieIdParamSchema, 'params'),
  validate(createReviewSchema),
  reviewController.create,
);

/**
 * @openapi
 * /reviews/{id}:
 *   get:
 *     tags: [Reviews]
 *     summary: Get one review (public)
 *     parameters:
 *       - $ref: '#/components/parameters/ReviewId'
 *     responses:
 *       200:
 *         description: The review
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Review' }
 *       400:
 *         description: Malformed id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Review not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
reviewRouter.get('/:id', validate(idParamSchema, 'params'), reviewController.getById);

/**
 * @openapi
 * /reviews/{id}:
 *   put:
 *     tags: [Reviews]
 *     summary: Edit a review (author only; send `rating`, `text` or both)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/ReviewId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 10 }
 *               text: { type: string, minLength: 1, maxLength: 2000 }
 *     responses:
 *       200:
 *         description: Updated review
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Review' }
 *       400:
 *         description: Validation error or malformed id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Caller is not the review's author (not even the movie owner can edit)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Review not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
reviewRouter.put(
  '/:id',
  requireAuth,
  validate(idParamSchema, 'params'),
  validate(updateReviewSchema),
  reviewController.update,
);

/**
 * @openapi
 * /reviews/{id}:
 *   delete:
 *     tags: [Reviews]
 *     summary: Delete a review (its author, or the owner of the reviewed movie)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/ReviewId'
 *     responses:
 *       204:
 *         description: Review deleted
 *       400:
 *         description: Malformed id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Caller is neither the review's author nor the movie's owner
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Review not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
reviewRouter.delete('/:id', requireAuth, validate(idParamSchema, 'params'), reviewController.remove);

export default reviewRouter;
