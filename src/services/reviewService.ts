import { AppError } from '../errors/AppError';
import type { IReview } from '../models/Review';
import { movieRepository } from '../repositories/movieRepository';
import { type ReviewDoc, reviewRepository } from '../repositories/reviewRepository';
import type { Page } from '../types/pagination';
import type { ReviewDto } from '../types/review';
import type { CreateReviewInput, ListReviewsQuery, UpdateReviewInput } from '../validators/review';

interface ReviewLike extends IReview {
  _id: unknown;
}

export function toReviewDto(review: ReviewLike): ReviewDto {
  return {
    id: String(review._id),
    movie: String(review.movie),
    createdBy: String(review.createdBy),
    rating: review.rating,
    text: review.text,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 11000;
}

async function requireMovie(movieId: string): Promise<void> {
  const movie = await movieRepository.findById(movieId);
  if (!movie) throw AppError.notFound('Movie not found');
}

async function findReview(id: string): Promise<ReviewDoc> {
  const review = await reviewRepository.findById(id);
  if (!review) throw AppError.notFound('Review not found');
  return review;
}

export async function create(movieId: string, userId: string, input: CreateReviewInput): Promise<ReviewDto> {
  await requireMovie(movieId);

  const review = await reviewRepository.create({ ...input, movie: movieId, createdBy: userId }).catch((err: unknown) => {
    // The unique index (movie + createdBy) is the source of truth, so it also covers two simultaneous requests.
    if (isDuplicateKeyError(err)) throw AppError.conflict('You have already reviewed this movie');
    throw err;
  });

  return toReviewDto(review);
}

export async function listForMovie(movieId: string, query: ListReviewsQuery): Promise<Page<ReviewDto>> {
  await requireMovie(movieId);
  const { items, total } = await reviewRepository.listByMovie(movieId, query);
  return { data: items.map(toReviewDto), page: query.page, limit: query.limit, total };
}

export async function getById(id: string): Promise<ReviewDto> {
  return toReviewDto(await findReview(id));
}

/** Only the review's author can edit it (the movie owner cannot). */
export async function update(id: string, userId: string, input: UpdateReviewInput): Promise<ReviewDto> {
  const review = await findReview(id);
  if (String(review.createdBy) !== userId) throw AppError.forbidden('Only the review author can edit it');
  return toReviewDto(await reviewRepository.update(review, input));
}

/** The review's author, or the owner of the reviewed movie (moderation), can delete it. */
export async function remove(id: string, userId: string): Promise<void> {
  const review = await findReview(id);

  if (String(review.createdBy) !== userId) {
    const movie = await movieRepository.findById(String(review.movie));
    if (!movie || String(movie.createdBy) !== userId) {
      throw AppError.forbidden('Only the review author or the movie owner can delete it');
    }
  }

  await reviewRepository.delete(review);
}
