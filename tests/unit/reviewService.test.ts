import mongoose from 'mongoose';
import { AppError } from '../../src/errors/AppError';
import { movieRepository } from '../../src/repositories/movieRepository';
import { reviewRepository } from '../../src/repositories/reviewRepository';
import * as reviewService from '../../src/services/reviewService';

jest.mock('../../src/repositories/reviewRepository');
jest.mock('../../src/repositories/movieRepository');

const reviews = jest.mocked(reviewRepository);
const movies = jest.mocked(movieRepository);

const id = () => new mongoose.Types.ObjectId().toString();
const authorId = id();
const movieOwnerId = id();
const strangerId = id();
const movieId = id();
const reviewId = id();

function fakeReview(overrides: Record<string, unknown> = {}) {
  return {
    _id: new mongoose.Types.ObjectId(reviewId),
    movie: new mongoose.Types.ObjectId(movieId),
    createdBy: new mongoose.Types.ObjectId(authorId),
    rating: 8,
    text: 'Great',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakeMovie() {
  return { _id: new mongoose.Types.ObjectId(movieId), createdBy: new mongoose.Types.ObjectId(movieOwnerId) };
}

/** Plain objects -> the repositories' Mongoose document types (only for mocks). */
const asDoc = (value: unknown) => value as never;

async function expectAppError(promise: Promise<unknown>, status: number) {
  const err = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).status).toBe(status);
}

beforeEach(() => jest.resetAllMocks());

describe('reviewService.create', () => {
  const input = { rating: 8, text: 'Great' };

  it('creates the review with movie from the URL and createdBy from the caller', async () => {
    movies.findById.mockResolvedValue(asDoc(fakeMovie()));
    reviews.create.mockResolvedValue(asDoc(fakeReview()));

    const result = await reviewService.create(movieId, authorId, input);

    expect(reviews.create).toHaveBeenCalledWith({ ...input, movie: movieId, createdBy: authorId });
    expect(result).toMatchObject({ id: reviewId, movie: movieId, createdBy: authorId, rating: 8 });
  });

  it('404 when the movie does not exist', async () => {
    movies.findById.mockResolvedValue(null);
    await expectAppError(reviewService.create(movieId, authorId, input), 404);
    expect(reviews.create).not.toHaveBeenCalled();
  });

  it('409 when the user already reviewed this movie (duplicate key)', async () => {
    movies.findById.mockResolvedValue(asDoc(fakeMovie()));
    reviews.create.mockRejectedValue(Object.assign(new Error('E11000 duplicate key'), { code: 11000 }));
    await expectAppError(reviewService.create(movieId, authorId, input), 409);
  });

  it('rethrows unexpected repository errors', async () => {
    movies.findById.mockResolvedValue(asDoc(fakeMovie()));
    reviews.create.mockRejectedValue(new Error('boom'));
    await expect(reviewService.create(movieId, authorId, input)).rejects.toThrow('boom');
  });
});

describe('reviewService.listForMovie', () => {
  it('returns { data, page, limit, total }', async () => {
    movies.findById.mockResolvedValue(asDoc(fakeMovie()));
    reviews.listByMovie.mockResolvedValue({ items: [asDoc(fakeReview())], total: 7 });

    const result = await reviewService.listForMovie(movieId, { page: 2, limit: 3 });

    expect(reviews.listByMovie).toHaveBeenCalledWith(movieId, { page: 2, limit: 3 });
    expect(result).toMatchObject({ page: 2, limit: 3, total: 7 });
    expect(result.data[0]).toMatchObject({ id: reviewId });
  });

  it('404 when the movie does not exist', async () => {
    movies.findById.mockResolvedValue(null);
    await expectAppError(reviewService.listForMovie(movieId, { page: 1, limit: 20 }), 404);
    expect(reviews.listByMovie).not.toHaveBeenCalled();
  });
});

describe('reviewService.getById', () => {
  it('returns the review', async () => {
    reviews.findById.mockResolvedValue(asDoc(fakeReview()));
    await expect(reviewService.getById(reviewId)).resolves.toMatchObject({ id: reviewId, text: 'Great' });
  });

  it('404 when it does not exist', async () => {
    reviews.findById.mockResolvedValue(null);
    await expectAppError(reviewService.getById(reviewId), 404);
  });
});

describe('reviewService.update', () => {
  it('lets the author edit, reusing the loaded review', async () => {
    const found = asDoc(fakeReview());
    reviews.findById.mockResolvedValue(found);
    reviews.update.mockResolvedValue(asDoc(fakeReview({ rating: 3 })));

    const result = await reviewService.update(reviewId, authorId, { rating: 3 });

    expect(reviews.findById).toHaveBeenCalledTimes(1);
    expect(reviews.update).toHaveBeenCalledWith(found, { rating: 3 });
    expect(result.rating).toBe(3);
  });

  it('404 when the review does not exist', async () => {
    reviews.findById.mockResolvedValue(null);
    await expectAppError(reviewService.update(reviewId, authorId, { rating: 3 }), 404);
    expect(reviews.update).not.toHaveBeenCalled();
  });

  it('403 for a stranger', async () => {
    reviews.findById.mockResolvedValue(asDoc(fakeReview()));
    await expectAppError(reviewService.update(reviewId, strangerId, { rating: 3 }), 403);
    expect(reviews.update).not.toHaveBeenCalled();
  });

  it('403 even for the movie owner: only the author edits', async () => {
    reviews.findById.mockResolvedValue(asDoc(fakeReview()));
    movies.findById.mockResolvedValue(asDoc(fakeMovie()));
    await expectAppError(reviewService.update(reviewId, movieOwnerId, { rating: 3 }), 403);
    expect(reviews.update).not.toHaveBeenCalled();
  });
});

describe('reviewService.remove', () => {
  it('lets the author delete without needing the movie', async () => {
    const found = asDoc(fakeReview());
    reviews.findById.mockResolvedValue(found);
    reviews.delete.mockResolvedValue(undefined);

    await reviewService.remove(reviewId, authorId);

    expect(reviews.delete).toHaveBeenCalledWith(found);
    expect(movies.findById).not.toHaveBeenCalled();
  });

  it("lets the movie's owner delete someone else's review", async () => {
    const found = asDoc(fakeReview());
    reviews.findById.mockResolvedValue(found);
    movies.findById.mockResolvedValue(asDoc(fakeMovie()));
    reviews.delete.mockResolvedValue(undefined);

    await reviewService.remove(reviewId, movieOwnerId);

    expect(movies.findById).toHaveBeenCalledWith(movieId);
    expect(reviews.delete).toHaveBeenCalledWith(found);
  });

  it('404 when the review does not exist', async () => {
    reviews.findById.mockResolvedValue(null);
    await expectAppError(reviewService.remove(reviewId, authorId), 404);
  });

  it('403 for a user who is neither the author nor the movie owner', async () => {
    reviews.findById.mockResolvedValue(asDoc(fakeReview()));
    movies.findById.mockResolvedValue(asDoc(fakeMovie()));
    await expectAppError(reviewService.remove(reviewId, strangerId), 403);
    expect(reviews.delete).not.toHaveBeenCalled();
  });

  it('403 for a stranger when the movie no longer exists', async () => {
    reviews.findById.mockResolvedValue(asDoc(fakeReview()));
    movies.findById.mockResolvedValue(null);
    await expectAppError(reviewService.remove(reviewId, strangerId), 403);
    expect(reviews.delete).not.toHaveBeenCalled();
  });
});
