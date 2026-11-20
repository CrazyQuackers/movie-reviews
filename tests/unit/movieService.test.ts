import mongoose from 'mongoose';
import { AppError } from '../../src/errors/AppError';
import { movieRepository } from '../../src/repositories/movieRepository';
import { reviewRepository } from '../../src/repositories/reviewRepository';
import * as movieService from '../../src/services/movieService';

jest.mock('../../src/repositories/movieRepository');
jest.mock('../../src/repositories/reviewRepository');

const repo = jest.mocked(movieRepository);
const reviews = jest.mocked(reviewRepository);

const ownerId = new mongoose.Types.ObjectId().toString();
const otherId = new mongoose.Types.ObjectId().toString();
const movieId = new mongoose.Types.ObjectId().toString();

function fakeMovie(overrides: Record<string, unknown> = {}) {
  return {
    _id: new mongoose.Types.ObjectId(movieId),
    title: 'The Matrix',
    releaseYear: 1999,
    genre: ['sci-fi'],
    director: 'Wachowski',
    actors: ['Keanu Reeves'],
    description: 'Wake up',
    createdBy: new mongoose.Types.ObjectId(ownerId),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** A movie as returned by the aggregation: the fields above plus its rating stats. */
const withStats = (averageRating: number | null, reviewCount: number, overrides: Record<string, unknown> = {}) =>
  ({ ...fakeMovie(overrides), averageRating, reviewCount }) as never;

/** Plain object -> the repository's Mongoose document type (only for mocks). */
const asDoc = (m: ReturnType<typeof fakeMovie>) => m as never;

async function expectAppError(promise: Promise<unknown>, status: number) {
  const err = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).status).toBe(status);
}

beforeEach(() => jest.resetAllMocks());

describe('movieService.create', () => {
  it('sets createdBy from the authenticated user and returns a DTO', async () => {
    repo.create.mockResolvedValue(asDoc(fakeMovie()));

    const result = await movieService.create(ownerId, {
      title: 'The Matrix',
      releaseYear: 1999,
      genre: ['sci-fi'],
      director: 'Wachowski',
      actors: [],
    });

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'The Matrix', createdBy: ownerId }));
    expect(result).toMatchObject({ id: movieId, title: 'The Matrix', createdBy: ownerId });
  });
});

describe('movieService.getById', () => {
  it('returns the movie with its rating stats', async () => {
    repo.findByIdWithStats.mockResolvedValue(withStats(7.5, 2));
    await expect(movieService.getById(movieId)).resolves.toMatchObject({
      id: movieId,
      averageRating: 7.5,
      reviewCount: 2,
    });
  });

  it('returns averageRating null and reviewCount 0 for a movie without reviews', async () => {
    repo.findByIdWithStats.mockResolvedValue(withStats(null, 0));
    await expect(movieService.getById(movieId)).resolves.toMatchObject({ averageRating: null, reviewCount: 0 });
  });

  it('404 when it does not exist', async () => {
    repo.findByIdWithStats.mockResolvedValue(null);
    await expectAppError(movieService.getById(movieId), 404);
  });
});

describe('movieService.list', () => {
  it('returns { data, page, limit, total } with rating stats on every item', async () => {
    repo.list.mockResolvedValue({ items: [withStats(9, 3)], total: 11 });

    const result = await movieService.list({ page: 2, limit: 5, minRating: 8, sort: '-averageRating' });

    expect(repo.list).toHaveBeenCalledWith({ page: 2, limit: 5, minRating: 8, sort: '-averageRating' });
    expect(result).toMatchObject({ page: 2, limit: 5, total: 11 });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ id: movieId, averageRating: 9, reviewCount: 3 });
  });
});

describe('movieService.update', () => {
  it('updates when the caller owns the movie, reusing the movie loaded for the ownership check', async () => {
    const found = asDoc(fakeMovie());
    repo.findById.mockResolvedValue(found);
    repo.update.mockResolvedValue(asDoc(fakeMovie({ title: 'Reloaded' })));

    const result = await movieService.update(movieId, ownerId, { title: 'Reloaded' });

    expect(repo.findById).toHaveBeenCalledTimes(1);
    expect(repo.update).toHaveBeenCalledWith(found, { title: 'Reloaded' });
    expect(result.title).toBe('Reloaded');
  });

  it('404 when the movie does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expectAppError(movieService.update(movieId, ownerId, { title: 'x' }), 404);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('403 when the caller is not the owner', async () => {
    repo.findById.mockResolvedValue(asDoc(fakeMovie()));
    await expectAppError(movieService.update(movieId, otherId, { title: 'x' }), 403);
    expect(repo.update).not.toHaveBeenCalled();
  });
});

describe('movieService.remove', () => {
  it('deletes the movie and then all its reviews when the caller owns the movie', async () => {
    const found = asDoc(fakeMovie());
    repo.findById.mockResolvedValue(found);
    repo.delete.mockResolvedValue(undefined);
    reviews.deleteByMovie.mockResolvedValue(undefined);

    await movieService.remove(movieId, ownerId);

    expect(repo.findById).toHaveBeenCalledTimes(1);
    expect(repo.delete).toHaveBeenCalledWith(found);
    expect(reviews.deleteByMovie).toHaveBeenCalledWith(movieId);
    expect(repo.delete.mock.invocationCallOrder[0]).toBeLessThan(reviews.deleteByMovie.mock.invocationCallOrder[0]);
  });

  it('404 when the movie does not exist and deletes nothing', async () => {
    repo.findById.mockResolvedValue(null);
    await expectAppError(movieService.remove(movieId, ownerId), 404);
    expect(repo.delete).not.toHaveBeenCalled();
    expect(reviews.deleteByMovie).not.toHaveBeenCalled();
  });

  it('403 when the caller is not the owner and deletes nothing', async () => {
    repo.findById.mockResolvedValue(asDoc(fakeMovie()));
    await expectAppError(movieService.remove(movieId, otherId), 403);
    expect(repo.delete).not.toHaveBeenCalled();
    expect(reviews.deleteByMovie).not.toHaveBeenCalled();
  });

  it('keeps the reviews if deleting the movie fails', async () => {
    repo.findById.mockResolvedValue(asDoc(fakeMovie()));
    repo.delete.mockRejectedValue(new Error('boom'));

    await expect(movieService.remove(movieId, ownerId)).rejects.toThrow('boom');

    expect(reviews.deleteByMovie).not.toHaveBeenCalled();
  });
});
