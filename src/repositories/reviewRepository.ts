import type { HydratedDocument } from 'mongoose';
import { type IReview, Review } from '../models/Review';
import type { CreateReviewInput, ListReviewsQuery, UpdateReviewInput } from '../validators/review';

export type ReviewDoc = HydratedDocument<IReview>;

export const reviewRepository = {
  async create(data: CreateReviewInput & { movie: string; createdBy: string }) {
    return Review.create(data);
  },

  async findById(id: string) {
    return Review.findById(id).exec();
  },

  /** Reviews of one movie, newest first. */
  async listByMovie(movieId: string, { page, limit }: ListReviewsQuery) {
    const [items, total] = await Promise.all([
      Review.find({ movie: movieId })
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      Review.countDocuments({ movie: movieId }).exec(),
    ]);
    return { items, total };
  },

  /** Applies `data` to an already-loaded review and saves it (validators run on save). */
  async update(review: ReviewDoc, data: UpdateReviewInput) {
    review.set(data);
    return review.save();
  },

  /** Deletes an already-loaded review. */
  async delete(review: ReviewDoc): Promise<void> {
    await review.deleteOne();
  },

  /** Deletes every review of a movie (used when the movie is deleted). */
  async deleteByMovie(movieId: string): Promise<void> {
    await Review.deleteMany({ movie: movieId }).exec();
  },
};
