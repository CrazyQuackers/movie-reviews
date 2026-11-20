import * as movieService from '../../src/services/movieService';
import { createUserAndToken } from '../helpers/auth';
import { clearTestDb, startTestDb, stopTestDb } from '../helpers/db';

beforeAll(startTestDb);
afterEach(clearTestDb);
afterAll(stopTestDb);

/** Seeds four movies one after another, so createdAt increases in this order. */
async function seed() {
  const { userId } = await createUserAndToken();
  const movies = [
    {
      title: 'The Matrix',
      releaseYear: 1999,
      genre: ['sci-fi', 'action'],
      director: 'Wachowski',
      actors: ['Keanu Reeves', 'Laurence Fishburne'],
    },
    {
      title: 'The Matrix Reloaded',
      releaseYear: 2003,
      genre: ['sci-fi', 'action'],
      director: 'Wachowski',
      actors: ['Keanu Reeves'],
    },
    {
      title: 'Inception',
      releaseYear: 2010,
      genre: ['sci-fi', 'thriller'],
      director: 'Nolan',
      actors: ['Leonardo DiCaprio'],
    },
    {
      title: 'Titanic',
      releaseYear: 1997,
      genre: ['drama', 'romance'],
      director: 'Cameron',
      actors: ['Leonardo DiCaprio', 'Kate Winslet'],
    },
  ];
  for (const movie of movies) await movieService.create(userId, movie);
}

const search = (query: Record<string, unknown> = {}) => movieService.list({ page: 1, limit: 20, ...query });
const titles = (page: { data: { title: string }[] }) => page.data.map((m) => m.title);

describe('movieService.list filters (with MongoDB)', () => {
  beforeEach(seed);

  it('title: partial, case-insensitive match', async () => {
    const result = await search({ title: 'MATRIX' });
    expect(titles(result).sort()).toEqual(['The Matrix', 'The Matrix Reloaded']);
    expect(result.total).toBe(2);
  });

  it('title: regex characters are matched literally', async () => {
    expect((await search({ title: '.*' })).total).toBe(0);
    expect((await search({ title: '(' })).total).toBe(0);
  });

  it('genre: matches any genre of the movie, case-insensitively', async () => {
    expect((await search({ genre: 'SCI-FI' })).total).toBe(3);
    expect((await search({ genre: 'romance' })).total).toBe(1);
  });

  it('genre: is an exact match, not a substring', async () => {
    expect((await search({ genre: 'sci' })).total).toBe(0);
  });

  it('year: exact release year', async () => {
    expect(titles(await search({ year: 1999 }))).toEqual(['The Matrix']);
  });

  it('director: exact, case-insensitive', async () => {
    expect(titles(await search({ director: 'nolan' }))).toEqual(['Inception']);
    expect((await search({ director: 'nol' })).total).toBe(0);
  });

  it('actor: matches any actor of the movie, case-insensitively', async () => {
    expect((await search({ actor: 'leonardo dicaprio' })).total).toBe(2);
    expect((await search({ actor: 'keanu reeves' })).total).toBe(2);
  });

  it('combines filters with AND', async () => {
    const result = await search({ genre: 'sci-fi', actor: 'Keanu Reeves', year: 2003 });
    expect(titles(result)).toEqual(['The Matrix Reloaded']);
  });

  it('returns an empty page when nothing matches', async () => {
    expect(await search({ title: 'zzz' })).toMatchObject({ data: [], total: 0, page: 1 });
  });

  it('paginates the filtered results and reports the filtered total', async () => {
    const page2 = await search({ genre: 'sci-fi', page: 2, limit: 2 });
    expect(page2.total).toBe(3);
    expect(page2.data).toHaveLength(1);
  });
});

describe('movieService.list sorting (with MongoDB)', () => {
  beforeEach(seed);

  it('defaults to newest first', async () => {
    expect(titles(await search())).toEqual(['Titanic', 'Inception', 'The Matrix Reloaded', 'The Matrix']);
  });

  it('sorts by title ascending and descending', async () => {
    expect(titles(await search({ sort: 'title' }))).toEqual([
      'Inception',
      'The Matrix',
      'The Matrix Reloaded',
      'Titanic',
    ]);
    expect(titles(await search({ sort: '-title' }))[0]).toBe('Titanic');
  });

  it('sorts by releaseYear ascending and descending', async () => {
    expect(titles(await search({ sort: 'releaseYear' }))[0]).toBe('Titanic');
    expect(titles(await search({ sort: '-releaseYear' }))[0]).toBe('Inception');
  });

  it('sorts by createdAt ascending', async () => {
    expect(titles(await search({ sort: 'createdAt' }))[0]).toBe('The Matrix');
  });

  it('sorts within filtered results', async () => {
    expect(titles(await search({ genre: 'sci-fi', sort: '-releaseYear' }))).toEqual([
      'Inception',
      'The Matrix Reloaded',
      'The Matrix',
    ]);
  });
});
