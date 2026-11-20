import mongoose from 'mongoose';
import { AppError } from '../../src/errors/AppError';
import { movieRepository } from '../../src/repositories/movieRepository';
import * as movieService from '../../src/services/movieService';

jest.mock('../../src/repositories/movieRepository');

const repo = jest.mocked(movieRepository);

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
  it('returns the movie', async () => {
    repo.findById.mockResolvedValue(asDoc(fakeMovie()));
    await expect(movieService.getById(movieId)).resolves.toMatchObject({ id: movieId });
  });

  it('404 when it does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expectAppError(movieService.getById(movieId), 404);
  });
});

describe('movieService.list', () => {
  it('returns { data, page, limit, total }', async () => {
    repo.list.mockResolvedValue({ items: [asDoc(fakeMovie())], total: 11 });

    const result = await movieService.list({ page: 2, limit: 5 });

    expect(repo.list).toHaveBeenCalledWith({ page: 2, limit: 5 });
    expect(result).toMatchObject({ page: 2, limit: 5, total: 11 });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ id: movieId });
  });
});

describe('movieService.update', () => {
  it('updates when the caller owns the movie', async () => {
    const found = asDoc(fakeMovie());
    repo.findById.mockResolvedValue(found);
    repo.update.mockResolvedValue(asDoc(fakeMovie({ title: 'Reloaded' })));

    const result = await movieService.update(movieId, ownerId, { title: 'Reloaded' });

    // Reuses the movie loaded for the ownership check: findById is called exactly once.
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
  it('deletes when the caller owns the movie', async () => {
    const found = asDoc(fakeMovie());
    repo.findById.mockResolvedValue(found);
    repo.delete.mockResolvedValue(undefined);

    await movieService.remove(movieId, ownerId);

    expect(repo.findById).toHaveBeenCalledTimes(1);
    expect(repo.delete).toHaveBeenCalledWith(found);
  });

  it('404 when the movie does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expectAppError(movieService.remove(movieId, ownerId), 404);
  });

  it('403 when the caller is not the owner', async () => {
    repo.findById.mockResolvedValue(asDoc(fakeMovie()));
    await expectAppError(movieService.remove(movieId, otherId), 403);
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
