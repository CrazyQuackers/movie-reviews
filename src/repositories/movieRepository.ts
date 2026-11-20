import type { QueryFilter, HydratedDocument } from 'mongoose';
import { type IMovie, Movie } from '../models/Movie';
import { escapeRegex } from '../utils/regex';
import type { CreateMovieInput, ListMoviesQuery, UpdateMovieInput } from '../validators/movie';

export type MovieDoc = HydratedDocument<IMovie>;

/** Case-insensitive match of the whole value. */
const exactly = (text: string) => new RegExp(`^${escapeRegex(text)}$`, 'i');

function buildFilter({ title, genre, year, director, actor }: ListMoviesQuery): QueryFilter<IMovie> {
  const filter: QueryFilter<IMovie> = {};
  if (title) filter.title = new RegExp(escapeRegex(title), 'i'); // partial
  if (genre) filter.genre = exactly(genre); // matches if any element matches
  if (year !== undefined) filter.releaseYear = year;
  if (director) filter.director = exactly(director);
  if (actor) filter.actors = exactly(actor);
  return filter;
}

/** "-field" = descending. Default: newest first. `_id` breaks ties so pages are stable. */
function buildSort(sort: ListMoviesQuery['sort'] = '-createdAt'): Record<string, 1 | -1> {
  const direction = sort.startsWith('-') ? -1 : 1;
  const field = sort.replace(/^-/, '');
  return { [field]: direction, _id: direction };
}

export const movieRepository = {
  async create(data: CreateMovieInput & { createdBy: string }) {
    return Movie.create(data);
  },

  async findById(id: string) {
    return Movie.findById(id).exec();
  },

  async list(query: ListMoviesQuery) {
    const filter = buildFilter(query);
    const { page, limit } = query;
    const [items, total] = await Promise.all([
      Movie.find(filter)
        .sort(buildSort(query.sort))
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      Movie.countDocuments(filter).exec(),
    ]);
    return { items, total };
  },

  /** Applies `data` to an already-loaded movie and saves it (validators run on save). */
  async update(movie: MovieDoc, data: UpdateMovieInput) {
    movie.set(data);
    return movie.save();
  },

  /** Deletes an already-loaded movie. */
  async delete(movie: MovieDoc): Promise<void> {
    await movie.deleteOne();
  },
};
