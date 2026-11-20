import mongoose from 'mongoose';
import { Review } from '../../src/models/Review';
import * as movieService from '../../src/services/movieService';
import * as reviewService from '../../src/services/reviewService';
import { createUserAndToken } from '../helpers/auth';
import { clearTestDb, startTestDb, stopTestDb } from '../helpers/db';

beforeAll(async () => {
  await startTestDb();
  await Review.init(); // make sure the unique index exists before the tests run
});
afterEach(clearTestDb);
afterAll(stopTestDb);

const movieInput = { title: 'Inception', releaseYear: 2010, genre: ['sci-fi'], director: 'Nolan', actors: [] };
const review = { rating: 9, text: 'Mind-bending' };

async function setup() {
  const owner = await createUserAndToken();
  const reviewer = await createUserAndToken();
  const movie = await movieService.create(owner.userId, movieInput);
  return { owner, reviewer, movie };
}

describe('reviewService (with MongoDB)', () => {
  it('create persists the review with movie and createdBy', async () => {
    const { reviewer, movie } = await setup();

    const created = await reviewService.create(movie.id, reviewer.userId, review);

    const saved = await Review.findById(created.id);
    expect(saved?.rating).toBe(9);
    expect(String(saved?.movie)).toBe(movie.id);
    expect(String(saved?.createdBy)).toBe(reviewer.userId);
  });

  it('create throws 404 for an unknown movie and saves nothing', async () => {
    const { reviewer } = await setup();
    const unknown = new mongoose.Types.ObjectId().toString();

    await expect(reviewService.create(unknown, reviewer.userId, review)).rejects.toMatchObject({ status: 404 });
    expect(await Review.countDocuments()).toBe(0);
  });

  it('a second review by the same user on the same movie is a 409 (unique index)', async () => {
    const { reviewer, movie } = await setup();
    await reviewService.create(movie.id, reviewer.userId, review);

    await expect(reviewService.create(movie.id, reviewer.userId, { rating: 1, text: 'Again' })).rejects.toMatchObject({
      status: 409,
    });
    expect(await Review.countDocuments()).toBe(1);
  });

  it('different users can review the same movie, and one user can review different movies', async () => {
    const { owner, reviewer, movie } = await setup();
    const other = await movieService.create(owner.userId, { ...movieInput, title: 'Other' });

    await reviewService.create(movie.id, reviewer.userId, review);
    await reviewService.create(movie.id, owner.userId, review);
    await reviewService.create(other.id, reviewer.userId, review);

    expect(await Review.countDocuments()).toBe(3);
  });

  it('listForMovie returns only that movie\'s reviews, newest first, paginated', async () => {
    const { owner, reviewer, movie } = await setup();
    const other = await movieService.create(owner.userId, { ...movieInput, title: 'Other' });
    const third = await createUserAndToken();
    await reviewService.create(movie.id, reviewer.userId, { rating: 5, text: 'first' });
    await reviewService.create(movie.id, third.userId, { rating: 6, text: 'second' });
    await reviewService.create(other.id, reviewer.userId, { rating: 7, text: 'elsewhere' });

    const page1 = await reviewService.listForMovie(movie.id, { page: 1, limit: 1 });
    const page2 = await reviewService.listForMovie(movie.id, { page: 2, limit: 1 });

    expect(page1.total).toBe(2);
    expect(page1.data.map((r) => r.text)).toEqual(['second']);
    expect(page2.data.map((r) => r.text)).toEqual(['first']);
  });

  it('listForMovie throws 404 for an unknown movie', async () => {
    await expect(
      reviewService.listForMovie(new mongoose.Types.ObjectId().toString(), { page: 1, limit: 20 }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('update changes only the given fields for the author', async () => {
    const { reviewer, movie } = await setup();
    const created = await reviewService.create(movie.id, reviewer.userId, review);

    const updated = await reviewService.update(created.id, reviewer.userId, { rating: 4 });

    expect(updated).toMatchObject({ rating: 4, text: 'Mind-bending' });
    expect((await Review.findById(created.id))?.rating).toBe(4);
  });

  it('update is forbidden for the movie owner and for strangers, and changes nothing', async () => {
    const { owner, reviewer, movie } = await setup();
    const stranger = await createUserAndToken();
    const created = await reviewService.create(movie.id, reviewer.userId, review);

    await expect(reviewService.update(created.id, owner.userId, { rating: 1 })).rejects.toMatchObject({ status: 403 });
    await expect(reviewService.update(created.id, stranger.userId, { rating: 1 })).rejects.toMatchObject({
      status: 403,
    });

    expect((await Review.findById(created.id))?.rating).toBe(9);
  });

  it('remove lets the author delete their review', async () => {
    const { reviewer, movie } = await setup();
    const created = await reviewService.create(movie.id, reviewer.userId, review);

    await reviewService.remove(created.id, reviewer.userId);

    expect(await Review.findById(created.id)).toBeNull();
  });

  it("remove lets the movie's owner delete someone else's review", async () => {
    const { owner, reviewer, movie } = await setup();
    const created = await reviewService.create(movie.id, reviewer.userId, review);

    await reviewService.remove(created.id, owner.userId);

    expect(await Review.findById(created.id)).toBeNull();
  });

  it('remove is forbidden for a stranger', async () => {
    const { reviewer, movie } = await setup();
    const stranger = await createUserAndToken();
    const created = await reviewService.create(movie.id, reviewer.userId, review);

    await expect(reviewService.remove(created.id, stranger.userId)).rejects.toMatchObject({ status: 403 });

    expect(await Review.findById(created.id)).not.toBeNull();
  });

  it('getById throws 404 for an unknown review', async () => {
    await expect(reviewService.getById(new mongoose.Types.ObjectId().toString())).rejects.toMatchObject({
      status: 404,
    });
  });
});
