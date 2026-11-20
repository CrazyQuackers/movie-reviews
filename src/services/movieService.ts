import { AppError } from '../errors/AppError';
import type { IMovie } from '../models/Movie';
import { type MovieDoc, type MovieWithStats, movieRepository } from '../repositories/movieRepository';
import { reviewRepository } from '../repositories/reviewRepository';
import type { MovieDto, MovieWithRatingsDto } from '../types/movie';
import type { Page } from '../types/pagination';
import type { CreateMovieInput, ListMoviesQuery, UpdateMovieInput } from '../validators/movie';

interface MovieLike extends IMovie {
  _id: unknown;
}

export function toMovieDto(movie: MovieLike): MovieDto {
  return {
    id: String(movie._id),
    title: movie.title,
    releaseYear: movie.releaseYear,
    genre: movie.genre,
    director: movie.director,
    actors: movie.actors,
    description: movie.description,
    createdBy: String(movie.createdBy),
    createdAt: movie.createdAt,
    updatedAt: movie.updatedAt,
  };
}

function toMovieWithRatingsDto(movie: MovieWithStats): MovieWithRatingsDto {
  return { ...toMovieDto(movie), averageRating: movie.averageRating, reviewCount: movie.reviewCount };
}

/** Loads a movie or throws 404; throws 403 unless `userId` owns it. */
async function findOwnedMovie(id: string, userId: string): Promise<MovieDoc> {
  const movie = await movieRepository.findById(id);
  if (!movie) throw AppError.notFound('Movie not found');
  if (String(movie.createdBy) !== userId) throw AppError.forbidden('Only the movie owner can do this');
  return movie;
}

export async function create(userId: string, input: CreateMovieInput): Promise<MovieDto> {
  return toMovieDto(await movieRepository.create({ ...input, createdBy: userId }));
}

export async function getById(id: string): Promise<MovieWithRatingsDto> {
  const movie = await movieRepository.findByIdWithStats(id);
  if (!movie) throw AppError.notFound('Movie not found');
  return toMovieWithRatingsDto(movie);
}

export async function list(query: ListMoviesQuery): Promise<Page<MovieWithRatingsDto>> {
  const { items, total } = await movieRepository.list(query);
  return { data: items.map(toMovieWithRatingsDto), page: query.page, limit: query.limit, total };
}

export async function update(id: string, userId: string, input: UpdateMovieInput): Promise<MovieDto> {
  const movie = await findOwnedMovie(id, userId);
  return toMovieDto(await movieRepository.update(movie, input));
}

/**
 * Deletes the movie, then its reviews. There is no transaction (a standalone MongoDB has none), so
 * the movie goes first: if the second step fails we are left with harmless orphan reviews, never
 * with a visible movie that silently lost its reviews.
 */
export async function remove(id: string, userId: string): Promise<void> {
  const movie = await findOwnedMovie(id, userId);
  await movieRepository.delete(movie);
  await reviewRepository.deleteByMovie(id);
}
