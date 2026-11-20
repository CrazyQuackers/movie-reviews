import { type HydratedDocument, type PipelineStage, type QueryFilter, Types } from 'mongoose';
import { type IMovie, Movie } from '../models/Movie';
import { Review } from '../models/Review';
import type { RatingStats } from '../types/movie';
import { escapeRegex } from '../utils/regex';
import type { CreateMovieInput, ListMoviesQuery, UpdateMovieInput } from '../validators/movie';

export type MovieDoc = HydratedDocument<IMovie>;

/** A movie as returned by the aggregations: the stored fields plus its review statistics. */
export interface MovieWithStats extends IMovie, RatingStats {
  _id: Types.ObjectId;
}

/**
 * Adds `averageRating` (1 decimal, null without reviews) and `reviewCount` to each movie.
 * The $lookup is served by the (movie, createdBy) index on reviews.
 */
const ratingStages: PipelineStage.FacetPipelineStage[] = [
  {
    $lookup: {
      from: Review.collection.name,
      localField: '_id',
      foreignField: 'movie',
      pipeline: [{ $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } }],
      as: 'stats',
    },
  },
  {
    $addFields: {
      averageRating: { $round: [{ $first: '$stats.average' }, 1] }, // null when there are no reviews
      reviewCount: { $ifNull: [{ $first: '$stats.count' }, 0] },
    },
  },
  { $project: { stats: 0 } },
];

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

/** `sort` is "field" (ascending) or "-field" (descending); the default is newest first. */
function parseSort(sort: ListMoviesQuery['sort'] = '-createdAt') {
  return { field: sort.replace(/^-/, ''), direction: sort.startsWith('-') ? (-1 as const) : (1 as const) };
}

const RATING_FIELDS = ['averageRating', 'reviewCount'];

/** True when the query filters or sorts by a rating field, so ratings are needed before paging. */
function usesRatings({ minRating, sort }: ListMoviesQuery): boolean {
  return minRating !== undefined || RATING_FIELDS.includes(parseSort(sort).field);
}

export const movieRepository = {
  async create(data: CreateMovieInput & { createdBy: string }) {
    return Movie.create(data);
  },

  async findById(id: string) {
    return Movie.findById(id).exec();
  },

  /** Like findById, but as a plain object that also carries averageRating and reviewCount. */
  async findByIdWithStats(id: string): Promise<MovieWithStats | null> {
    // Aggregations don't cast values like find() does, so build the ObjectId ourselves.
    const [movie] = await Movie.aggregate<MovieWithStats>([
      { $match: { _id: new Types.ObjectId(id) } },
      ...ratingStages,
    ]);
    return movie ?? null;
  },

  /** Filtered, sorted, paginated movies with their rating stats, plus the total number of matches. */
  async list(query: ListMoviesQuery): Promise<{ items: MovieWithStats[]; total: number }> {
    const { page, limit, minRating } = query;
    const { field, direction } = parseSort(query.sort);

    const matchFilters: PipelineStage = { $match: buildFilter(query) };
    // `_id` breaks ties so pages are stable.
    const sortAndPage: PipelineStage.FacetPipelineStage[] = [
      { $sort: { [field]: direction, _id: direction } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ];
    const countAll: PipelineStage.FacetPipelineStage[] = [{ $count: 'count' }];

    let pipeline: PipelineStage[];
    if (usesRatings(query)) {
      // Sorting or filtering by rating: every match needs its ratings before we can sort, filter and count.
      const atLeastMinRating: PipelineStage[] =
        minRating === undefined ? [] : [{ $match: { averageRating: { $gte: minRating } } }];
      pipeline = [
        matchFilters,
        ...ratingStages,
        ...atLeastMinRating,
        { $facet: { items: sortAndPage, total: countAll } },
      ];
    } else {
      // Otherwise only the movies on the requested page need their ratings.
      pipeline = [matchFilters, { $facet: { items: [...sortAndPage, ...ratingStages], total: countAll } }];
    }

    const [result] = await Movie.aggregate<{ items: MovieWithStats[]; total: { count: number }[] }>(pipeline);
    return { items: result.items, total: result.total[0]?.count ?? 0 };
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
