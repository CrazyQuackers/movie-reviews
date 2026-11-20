import { Movie } from '../../src/models/Movie';
import { Review } from '../../src/models/Review';
import * as movieService from '../../src/services/movieService';
import * as reviewService from '../../src/services/reviewService';
import { createUserAndToken } from '../helpers/auth';
import { clearTestDb, startTestDb, stopTestDb } from '../helpers/db';

beforeAll(async () => {
  await startTestDb();
  await Review.init();
});
afterEach(clearTestDb);
afterAll(stopTestDb);

const base = { releaseYear: 2000, genre: ['drama'], director: 'Someone', actors: [] };

/**
 * Alpha: ratings 7, 8       -> average 7.5, 2 reviews
 * Bravo: ratings 8, 8, 9    -> average 8.333.. shown as 8.3, 3 reviews
 * Charlie: no reviews       -> average null, 0 reviews
 */
async function seed() {
  const owner = await createUserAndToken();
  const [u1, u2, u3] = [await createUserAndToken(), await createUserAndToken(), await createUserAndToken()];

  const alpha = await movieService.create(owner.userId, { ...base, title: 'Alpha' });
  const bravo = await movieService.create(owner.userId, { ...base, title: 'Bravo' });
  const charlie = await movieService.create(owner.userId, { ...base, title: 'Charlie' });

  const r = (movieId: string, userId: string, rating: number) =>
    reviewService.create(movieId, userId, { rating, text: `rated ${rating}` });
  const alphaReview = await r(alpha.id, u1.userId, 7);
  await r(alpha.id, u2.userId, 8);
  await r(bravo.id, u1.userId, 8);
  await r(bravo.id, u2.userId, 8);
  await r(bravo.id, u3.userId, 9);

  return { owner, users: [u1, u2, u3], alpha, bravo, charlie, alphaReview };
}

const search = (query: Record<string, unknown> = {}) => movieService.list({ page: 1, limit: 20, ...query });
const titles = (page: { data: { title: string }[] }) => page.data.map((m) => m.title);

describe('rating stats on a single movie (with MongoDB)', () => {
  it('getById returns averageRating (1 decimal) and reviewCount', async () => {
    const { alpha, bravo } = await seed();

    expect(await movieService.getById(alpha.id)).toMatchObject({ averageRating: 7.5, reviewCount: 2 });
    expect(await movieService.getById(bravo.id)).toMatchObject({ averageRating: 8.3, reviewCount: 3 });
  });

  it('getById returns null and 0 for a movie without reviews', async () => {
    const { charlie } = await seed();
    expect(await movieService.getById(charlie.id)).toMatchObject({ averageRating: null, reviewCount: 0 });
  });

  it('only counts the reviews of that movie', async () => {
    const { alpha } = await seed();
    expect((await movieService.getById(alpha.id)).reviewCount).toBe(2);
  });

  it('follows edited and deleted reviews', async () => {
    const { alpha, users, alphaReview } = await seed();

    await reviewService.update(alphaReview.id, users[0].userId, { rating: 10 });
    expect(await movieService.getById(alpha.id)).toMatchObject({ averageRating: 9, reviewCount: 2 });

    await reviewService.remove(alphaReview.id, users[0].userId);
    expect(await movieService.getById(alpha.id)).toMatchObject({ averageRating: 8, reviewCount: 1 });
  });
});

describe('rating stats in the movie list (with MongoDB)', () => {
  it('includes averageRating and reviewCount on every movie', async () => {
    await seed();

    const byTitle = Object.fromEntries((await search()).data.map((m) => [m.title, m]));

    expect(byTitle.Alpha).toMatchObject({ averageRating: 7.5, reviewCount: 2 });
    expect(byTitle.Bravo).toMatchObject({ averageRating: 8.3, reviewCount: 3 });
    expect(byTitle.Charlie).toMatchObject({ averageRating: null, reviewCount: 0 });
  });

  it('keeps the default order (newest first) and the total', async () => {
    await seed();
    const result = await search();
    expect(titles(result)).toEqual(['Charlie', 'Bravo', 'Alpha']);
    expect(result.total).toBe(3);
  });

  it('minRating keeps movies whose average is at least that, and drops unrated ones', async () => {
    await seed();
    expect(titles(await search({ minRating: 8 }))).toEqual(['Bravo']);
    expect(titles(await search({ minRating: 7.5, sort: 'title' }))).toEqual(['Alpha', 'Bravo']);
    expect(titles(await search({ minRating: 1, sort: 'title' }))).toEqual(['Alpha', 'Bravo']);
    expect((await search({ minRating: 9 })).total).toBe(0);
  });

  it('sorts by averageRating, unrated movies counting as lowest', async () => {
    await seed();
    expect(titles(await search({ sort: '-averageRating' }))).toEqual(['Bravo', 'Alpha', 'Charlie']);
    expect(titles(await search({ sort: 'averageRating' }))).toEqual(['Charlie', 'Alpha', 'Bravo']);
  });

  it('sorts by reviewCount', async () => {
    await seed();
    expect(titles(await search({ sort: '-reviewCount' }))).toEqual(['Bravo', 'Alpha', 'Charlie']);
    expect(titles(await search({ sort: 'reviewCount' }))).toEqual(['Charlie', 'Alpha', 'Bravo']);
  });

  it('combines rating filters and sorts with the other filters', async () => {
    await seed();
    const result = await search({ title: 'a', minRating: 7, sort: '-reviewCount' }); // Alpha, Bravo, Charlie all contain "a"
    expect(titles(result)).toEqual(['Bravo', 'Alpha']);
  });

  it('paginates rating-sorted results and reports the filtered total', async () => {
    await seed();
    const page1 = await search({ minRating: 7, sort: '-reviewCount', page: 1, limit: 1 });
    const page2 = await search({ minRating: 7, sort: '-reviewCount', page: 2, limit: 1 });
    const page3 = await search({ minRating: 7, sort: '-reviewCount', page: 3, limit: 1 });

    expect(page1.total).toBe(2);
    expect(titles(page1)).toEqual(['Bravo']);
    expect(titles(page2)).toEqual(['Alpha']);
    expect(page3).toMatchObject({ data: [], total: 2 });
  });

  it('returns an empty page when nothing matches', async () => {
    await seed();
    expect(await search({ title: 'zzz', sort: '-averageRating' })).toMatchObject({ data: [], total: 0 });
  });
});

describe('deleting a movie deletes its reviews (with MongoDB)', () => {
  it('removes the movie and only that movie\'s reviews', async () => {
    const { owner, alpha, bravo } = await seed();

    await movieService.remove(bravo.id, owner.userId);

    expect(await Movie.findById(bravo.id)).toBeNull();
    expect(await Review.countDocuments({ movie: bravo.id })).toBe(0);
    expect(await Review.countDocuments({ movie: alpha.id })).toBe(2);
  });

  it('works for a movie without reviews', async () => {
    const { owner, charlie } = await seed();
    await movieService.remove(charlie.id, owner.userId);
    expect(await Movie.findById(charlie.id)).toBeNull();
    expect(await Review.countDocuments()).toBe(5);
  });

  it('a forbidden delete keeps both the movie and its reviews', async () => {
    const { users, bravo } = await seed();

    await expect(movieService.remove(bravo.id, users[0].userId)).rejects.toMatchObject({ status: 403 });

    expect(await Movie.findById(bravo.id)).not.toBeNull();
    expect(await Review.countDocuments({ movie: bravo.id })).toBe(3);
  });
});
