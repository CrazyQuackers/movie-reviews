import request from 'supertest';
import { createApp } from '../../src/app';
import { Review } from '../../src/models/Review';
import { createUserAndToken } from '../helpers/auth';
import { clearTestDb, startTestDb, stopTestDb } from '../helpers/db';

const app = createApp();

beforeAll(async () => {
  await startTestDb();
  await Review.init();
});
afterEach(clearTestDb);
afterAll(stopTestDb);

const movieBody = { title: 'The Matrix', releaseYear: 1999, genre: ['sci-fi'], director: 'Wachowski' };

async function createMovie(authHeader: string, title = 'The Matrix') {
  const res = await request(app)
    .post('/movies')
    .set('Authorization', authHeader)
    .send({ ...movieBody, title });
  return res.body as { id: string };
}

const review = (movieId: string, authHeader: string, rating: number) =>
  request(app).post(`/movies/${movieId}/reviews`).set('Authorization', authHeader).send({ rating, text: `rated ${rating}` });

describe('rating stats through the API', () => {
  it('a movie without reviews has averageRating null and reviewCount 0 in detail and list', async () => {
    const owner = await createUserAndToken();
    const movie = await createMovie(owner.authHeader);

    const detail = await request(app).get(`/movies/${movie.id}`);
    const list = await request(app).get('/movies');

    expect(detail.body).toMatchObject({ averageRating: null, reviewCount: 0 });
    expect(list.body.data[0]).toMatchObject({ averageRating: null, reviewCount: 0 });
  });

  it('flow: movie -> reviews -> stats show up -> edit and delete change them -> deleting the movie removes the reviews', async () => {
    const owner = await createUserAndToken();
    const [u1, u2] = [await createUserAndToken(), await createUserAndToken()];
    const movie = await createMovie(owner.authHeader);

    const first = await review(movie.id, u1.authHeader, 7);
    await review(movie.id, u2.authHeader, 8);

    const detail = await request(app).get(`/movies/${movie.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({ averageRating: 7.5, reviewCount: 2 });
    expect((await request(app).get('/movies')).body.data[0]).toMatchObject({ averageRating: 7.5, reviewCount: 2 });

    await request(app).put(`/reviews/${first.body.id}`).set('Authorization', u1.authHeader).send({ rating: 9 }).expect(200);
    expect((await request(app).get(`/movies/${movie.id}`)).body).toMatchObject({ averageRating: 8.5, reviewCount: 2 });

    await request(app).delete(`/reviews/${first.body.id}`).set('Authorization', u1.authHeader).expect(204);
    expect((await request(app).get(`/movies/${movie.id}`)).body).toMatchObject({ averageRating: 8, reviewCount: 1 });

    await request(app).delete(`/movies/${movie.id}`).set('Authorization', owner.authHeader).expect(204);
    expect((await request(app).get(`/movies/${movie.id}`)).status).toBe(404);
    expect((await request(app).get(`/movies/${movie.id}/reviews`)).status).toBe(404);
    expect(await Review.countDocuments()).toBe(0);
  });

  it("deleting a movie does not touch another movie's reviews", async () => {
    const owner = await createUserAndToken();
    const reviewer = await createUserAndToken();
    const a = await createMovie(owner.authHeader, 'A');
    const b = await createMovie(owner.authHeader, 'B');
    await review(a.id, reviewer.authHeader, 5);
    await review(b.id, reviewer.authHeader, 9);

    await request(app).delete(`/movies/${a.id}`).set('Authorization', owner.authHeader).expect(204);

    expect((await request(app).get(`/movies/${b.id}`)).body).toMatchObject({ averageRating: 9, reviewCount: 1 });
    expect((await request(app).get(`/movies/${b.id}/reviews`)).body.total).toBe(1);
  });
});

describe('GET /movies rating filter and sort', () => {
  async function seed() {
    const owner = await createUserAndToken();
    const [u1, u2] = [await createUserAndToken(), await createUserAndToken()];
    const low = await createMovie(owner.authHeader, 'Low');
    const high = await createMovie(owner.authHeader, 'High');
    await createMovie(owner.authHeader, 'Unrated');
    await review(low.id, u1.authHeader, 4);
    await review(high.id, u1.authHeader, 9);
    await review(high.id, u2.authHeader, 10);
  }
  const titles = (body: { data: { title: string }[] }) => body.data.map((m) => m.title);

  it('minRating keeps only movies with a high enough average', async () => {
    await seed();
    expect(titles((await request(app).get('/movies?minRating=5')).body)).toEqual(['High']);
    expect(titles((await request(app).get('/movies?minRating=4&sort=title')).body)).toEqual(['High', 'Low']);
  });

  it('sorts by averageRating and reviewCount', async () => {
    await seed();
    expect(titles((await request(app).get('/movies?sort=-averageRating')).body)).toEqual(['High', 'Low', 'Unrated']);
    expect(titles((await request(app).get('/movies?sort=averageRating')).body)).toEqual(['Unrated', 'Low', 'High']);
    expect(titles((await request(app).get('/movies?sort=-reviewCount')).body)).toEqual(['High', 'Low', 'Unrated']);
  });

  it('reports the filtered total when paginating', async () => {
    await seed();
    const res = await request(app).get('/movies?minRating=1&sort=-averageRating&limit=1&page=2');
    expect(res.body).toMatchObject({ page: 2, limit: 1, total: 2 });
    expect(titles(res.body)).toEqual(['Low']);
  });

  it.each([
    ['minRating below 1', 'minRating=0'],
    ['minRating above 10', 'minRating=11'],
    ['non-numeric minRating', 'minRating=high'],
  ])('400 for %s', async (_name, query) => {
    const res = await request(app).get(`/movies?${query}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
