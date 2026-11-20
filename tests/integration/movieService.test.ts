import mongoose from 'mongoose';
import { Movie } from '../../src/models/Movie';
import * as movieService from '../../src/services/movieService';
import { createUserAndToken } from '../helpers/auth';
import { clearTestDb, startTestDb, stopTestDb } from '../helpers/db';

beforeAll(startTestDb);
afterEach(clearTestDb);
afterAll(stopTestDb);

const input = {
  title: 'Inception',
  releaseYear: 2010,
  genre: ['sci-fi', 'thriller'],
  director: 'Nolan',
  actors: ['DiCaprio'],
};

describe('movieService (with MongoDB)', () => {
  it('create persists the movie with createdBy from the caller', async () => {
    const { userId } = await createUserAndToken();

    const movie = await movieService.create(userId, input);

    const saved = await Movie.findById(movie.id);
    expect(saved?.title).toBe('Inception');
    expect(String(saved?.createdBy)).toBe(userId);
  });

  it('getById throws 404 for an unknown id', async () => {
    await expect(movieService.getById(new mongoose.Types.ObjectId().toString())).rejects.toMatchObject({
      status: 404,
    });
  });

  it('list paginates and reports the total', async () => {
    const { userId } = await createUserAndToken();
    for (let i = 0; i < 3; i++) await movieService.create(userId, { ...input, title: `Movie ${i}` });

    const page = await movieService.list({ page: 1, limit: 2 });

    expect(page.total).toBe(3);
    expect(page.data).toHaveLength(2);
    expect((await movieService.list({ page: 2, limit: 2 })).data).toHaveLength(1);
  });

  it('update changes only the given fields for the owner', async () => {
    const { userId } = await createUserAndToken();
    const movie = await movieService.create(userId, input);

    const updated = await movieService.update(movie.id, userId, { title: 'Inception 2' });

    expect(updated.title).toBe('Inception 2');
    expect(updated.director).toBe('Nolan');
  });

  it('update and remove are forbidden for a non-owner and change nothing', async () => {
    const owner = await createUserAndToken();
    const other = await createUserAndToken();
    const movie = await movieService.create(owner.userId, input);

    await expect(movieService.update(movie.id, other.userId, { title: 'Hacked' })).rejects.toMatchObject({
      status: 403,
    });
    await expect(movieService.remove(movie.id, other.userId)).rejects.toMatchObject({ status: 403 });

    expect((await Movie.findById(movie.id))?.title).toBe('Inception');
  });

  it('remove deletes the movie for the owner', async () => {
    const { userId } = await createUserAndToken();
    const movie = await movieService.create(userId, input);

    await movieService.remove(movie.id, userId);

    expect(await Movie.findById(movie.id)).toBeNull();
  });
});
