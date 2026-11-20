import { AppError } from '../errors/AppError';
import type { IMovie } from '../models/Movie';
import { type MovieDoc, movieRepository } from '../repositories/movieRepository';
import type { MovieDto } from '../types/movie';
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

/** Loads a movie or throws 404; throws 403 unless `userId` owns it. */
async function findOwnedMovie(id: string, userId: string): Promise<MovieDoc> {
  const movie = await movieRepository.findById(id);
  if (!movie) throw AppError.notFound('Movie not found');
  if (String(movie.createdBy) !== userId) throw AppError.forbidden('Only the movie owner can do this');
  return movie;
}

export async function create(userId: string, input: CreateMovieInput): Promise<MovieDto> {
  const movie = await movieRepository.create({ ...input, createdBy: userId });
  return toMovieDto(movie);
}

export async function getById(id: string): Promise<MovieDto> {
  const movie = await movieRepository.findById(id);
  if (!movie) throw AppError.notFound('Movie not found');
  return toMovieDto(movie);
}

export async function list(query: ListMoviesQuery): Promise<Page<MovieDto>> {
  const { items, total } = await movieRepository.list(query);
  return { data: items.map(toMovieDto), page: query.page, limit: query.limit, total };
}

export async function update(id: string, userId: string, input: UpdateMovieInput): Promise<MovieDto> {
  const movie = await findOwnedMovie(id, userId);
  return toMovieDto(await movieRepository.update(movie, input));
}

export async function remove(id: string, userId: string): Promise<void> {
  const movie = await findOwnedMovie(id, userId);
  await movieRepository.delete(movie);
}
