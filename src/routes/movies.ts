import { Router } from 'express';
import * as movieController from '../controllers/movieController';
import { requireAuth } from '../middlewares/requireAuth';
import { validate } from '../middlewares/validate';
import { createMovieSchema, idParamSchema, listMoviesQuerySchema, updateMovieSchema } from '../validators/movie';

const router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     Movie:
 *       type: object
 *       properties:
 *         id: { type: string, example: 507f1f77bcf86cd799439011 }
 *         title: { type: string, example: The Matrix }
 *         releaseYear: { type: integer, example: 1999 }
 *         genre: { type: array, items: { type: string }, example: [sci-fi, action] }
 *         director: { type: string, example: Lana Wachowski }
 *         actors: { type: array, items: { type: string }, example: [Keanu Reeves] }
 *         description: { type: string, example: A hacker learns the truth about reality. }
 *         createdBy: { type: string, description: Id of the user who owns the movie, example: 507f1f77bcf86cd799439012 }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     MovieInput:
 *       type: object
 *       required: [title, releaseYear, genre, director]
 *       properties:
 *         title: { type: string, example: The Matrix }
 *         releaseYear: { type: integer, minimum: 1888, description: 'Between 1888 and the current year + 5', example: 1999 }
 *         genre: { type: array, minItems: 1, items: { type: string }, example: [sci-fi, action] }
 *         director: { type: string, example: Lana Wachowski }
 *         actors: { type: array, items: { type: string }, example: [Keanu Reeves] }
 *         description: { type: string }
 *     MovieList:
 *       type: object
 *       properties:
 *         data: { type: array, items: { $ref: '#/components/schemas/Movie' } }
 *         page: { type: integer, example: 1 }
 *         limit: { type: integer, example: 20 }
 *         total: { type: integer, example: 42 }
 *   parameters:
 *     MovieId:
 *       name: id
 *       in: path
 *       required: true
 *       description: Movie id (Mongo ObjectId)
 *       schema: { type: string, example: 507f1f77bcf86cd799439011 }
 */

/**
 * @openapi
 * /movies:
 *   get:
 *     tags: [Movies]
 *     summary: Search and list movies (public)
 *     description: All filters are optional and combined with AND. `total` is the number of movies matching the filters.
 *     parameters:
 *       - { name: title, in: query, description: Partial, case-insensitive match on the title, schema: { type: string, example: matrix } }
 *       - { name: genre, in: query, description: Case-insensitive exact match on any of the movie's genres, schema: { type: string, example: sci-fi } }
 *       - { name: year, in: query, description: Exact release year, schema: { type: integer, example: 1999 } }
 *       - { name: director, in: query, description: Case-insensitive exact match on the director, schema: { type: string, example: Lana Wachowski } }
 *       - { name: actor, in: query, description: Case-insensitive exact match on any of the movie's actors, schema: { type: string, example: Keanu Reeves } }
 *       - name: sort
 *         in: query
 *         description: Field to sort by; prefix with `-` for descending. Defaults to newest first (`-createdAt`).
 *         schema:
 *           type: string
 *           enum: [title, -title, releaseYear, -releaseYear, createdAt, -createdAt]
 *       - { name: page, in: query, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *     responses:
 *       200:
 *         description: A page of movies, newest first
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MovieList' }
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/', validate(listMoviesQuerySchema, 'query'), movieController.list);

/**
 * @openapi
 * /movies/{id}:
 *   get:
 *     tags: [Movies]
 *     summary: Get one movie (public)
 *     parameters:
 *       - $ref: '#/components/parameters/MovieId'
 *     responses:
 *       200:
 *         description: The movie
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Movie' }
 *       400:
 *         description: Malformed id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Movie not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id', validate(idParamSchema, 'params'), movieController.getById);

/**
 * @openapi
 * /movies:
 *   post:
 *     tags: [Movies]
 *     summary: Create a movie (the caller becomes its owner)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/MovieInput' }
 *     responses:
 *       201:
 *         description: Movie created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Movie' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/', requireAuth, validate(createMovieSchema), movieController.create);

/**
 * @openapi
 * /movies/{id}:
 *   put:
 *     tags: [Movies]
 *     summary: Update a movie (owner only; send any subset of the fields, at least one)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/MovieId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             description: Any subset of the MovieInput fields
 *             properties:
 *               title: { type: string }
 *               releaseYear: { type: integer }
 *               genre: { type: array, minItems: 1, items: { type: string } }
 *               director: { type: string }
 *               actors: { type: array, items: { type: string } }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Updated movie
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Movie' }
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
 *         description: Caller does not own the movie
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Movie not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.put(
  '/:id',
  requireAuth,
  validate(idParamSchema, 'params'),
  validate(updateMovieSchema),
  movieController.update,
);

/**
 * @openapi
 * /movies/{id}:
 *   delete:
 *     tags: [Movies]
 *     summary: Delete a movie (owner only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/MovieId'
 *     responses:
 *       204:
 *         description: Movie deleted
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
 *         description: Caller does not own the movie
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Movie not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete('/:id', requireAuth, validate(idParamSchema, 'params'), movieController.remove);

export default router;
