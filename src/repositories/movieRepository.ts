import type { HydratedDocument } from 'mongoose';
import { type IMovie, Movie } from '../models/Movie';
import type { CreateMovieInput, ListMoviesQuery, UpdateMovieInput } from '../validators/movie';

export type MovieDoc = HydratedDocument<IMovie>;

export const movieRepository = {
  async create(data: CreateMovieInput & { createdBy: string }) {
    return Movie.create(data);
  },

  async findById(id: string) {
    return Movie.findById(id).exec();
  },

  async list({ page, limit }: ListMoviesQuery) {
    const [items, total] = await Promise.all([
      Movie.find()
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      Movie.countDocuments().exec(),
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
