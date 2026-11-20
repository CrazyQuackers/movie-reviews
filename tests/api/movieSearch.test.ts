import request from 'supertest';
import { createApp } from '../../src/app';
import { createUserAndToken } from '../helpers/auth';
import { clearTestDb, startTestDb, stopTestDb } from '../helpers/db';

const app = createApp();

beforeAll(startTestDb);
afterEach(clearTestDb);
afterAll(stopTestDb);

const movies = [
  { title: 'The Matrix', releaseYear: 1999, genre: ['sci-fi', 'action'], director: 'Wachowski', actors: ['Keanu Reeves'] },
  { title: 'Inception', releaseYear: 2010, genre: ['sci-fi', 'thriller'], director: 'Nolan', actors: ['Leonardo DiCaprio'] },
  { title: 'Titanic', releaseYear: 1997, genre: ['drama', 'romance'], director: 'Cameron', actors: ['Leonardo DiCaprio'] },
];

beforeEach(async () => {
  const { authHeader } = await createUserAndToken();
  for (const movie of movies) {
    await request(app).post('/movies').set('Authorization', authHeader).send(movie).expect(201);
  }
});

const titles = (body: { data: { title: string }[] }) => body.data.map((m) => m.title);

describe('GET /movies search', () => {
  it('filters by title (partial, case-insensitive)', async () => {
    const res = await request(app).get('/movies?title=matr');
    expect(res.status).toBe(200);
    expect(titles(res.body)).toEqual(['The Matrix']);
    expect(res.body.total).toBe(1);
  });

  it('filters by genre, year, director and actor', async () => {
    expect(titles((await request(app).get('/movies?genre=Sci-Fi')).body).sort()).toEqual(['Inception', 'The Matrix']);
    expect(titles((await request(app).get('/movies?year=1997')).body)).toEqual(['Titanic']);
    expect(titles((await request(app).get('/movies?director=nolan')).body)).toEqual(['Inception']);
    expect(titles((await request(app).get('/movies?actor=leonardo%20dicaprio')).body).sort()).toEqual([
      'Inception',
      'Titanic',
    ]);
  });

  it('combines filters', async () => {
    const res = await request(app).get('/movies?genre=sci-fi&actor=Leonardo%20DiCaprio');
    expect(titles(res.body)).toEqual(['Inception']);
  });

  it('treats regex characters in filters literally', async () => {
    const res = await request(app).get('/movies?title=.*');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  it('sorts ascending and descending', async () => {
    const asc = await request(app).get('/movies?sort=releaseYear');
    const desc = await request(app).get('/movies?sort=-releaseYear');
    expect(titles(asc.body)).toEqual(['Titanic', 'The Matrix', 'Inception']);
    expect(titles(desc.body)).toEqual(['Inception', 'The Matrix', 'Titanic']);
  });

  it('paginates filtered results with the filtered total', async () => {
    const res = await request(app).get('/movies?genre=sci-fi&limit=1&page=2&sort=title');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 2, limit: 1, total: 2 });
    expect(titles(res.body)).toEqual(['The Matrix']);
  });

  it('is still public (no token needed)', async () => {
    expect((await request(app).get('/movies?genre=drama')).status).toBe(200);
  });

  it.each([
    ['unknown sort field', 'sort=rating'],
    ['non-numeric year', 'year=abc'],
    ['non-integer year', 'year=1999.5'],
    ['empty title', 'title='],
  ])('400 for %s', async (_name, query) => {
    const res = await request(app).get(`/movies?${query}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
