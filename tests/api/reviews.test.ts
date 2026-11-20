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

const UNKNOWN_ID = '507f1f77bcf86cd799439011';
const movieBody = { title: 'The Matrix', releaseYear: 1999, genre: ['sci-fi'], director: 'Wachowski' };
const reviewBody = { rating: 8, text: 'Great movie' };

/** A movie owner, a reviewer and a stranger, plus one movie. */
async function setup() {
  const owner = await createUserAndToken();
  const reviewer = await createUserAndToken();
  const stranger = await createUserAndToken();
  const { body: movie } = await request(app).post('/movies').set('Authorization', owner.authHeader).send(movieBody);
  return { owner, reviewer, stranger, movie };
}

function postReview(movieId: string, authHeader: string, body: Record<string, unknown> = reviewBody) {
  return request(app).post(`/movies/${movieId}/reviews`).set('Authorization', authHeader).send(body);
}

describe('POST /movies/:movieId/reviews', () => {
  it('201 creates a review owned by the token user, ignoring createdBy and movie in the body', async () => {
    const { reviewer, movie } = await setup();

    const res = await postReview(movie.id, reviewer.authHeader, {
      ...reviewBody,
      createdBy: UNKNOWN_ID,
      movie: UNKNOWN_ID,
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      movie: movie.id,
      createdBy: reviewer.userId,
      rating: 8,
      text: 'Great movie',
    });
  });

  it('lets users review their own movie (spec default)', async () => {
    const { owner, movie } = await setup();
    expect((await postReview(movie.id, owner.authHeader)).status).toBe(201);
  });

  it('409 when the same user reviews the same movie twice', async () => {
    const { reviewer, movie } = await setup();
    await postReview(movie.id, reviewer.authHeader);

    const res = await postReview(movie.id, reviewer.authHeader, { rating: 2, text: 'Second try' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('404 when the movie does not exist', async () => {
    const { reviewer } = await setup();
    const res = await postReview(UNKNOWN_ID, reviewer.authHeader);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('401 without a token', async () => {
    const { movie } = await setup();
    const res = await request(app).post(`/movies/${movie.id}/reviews`).send(reviewBody);
    expect(res.status).toBe(401);
  });

  it('400 for a malformed movie id', async () => {
    const { reviewer } = await setup();
    expect((await postReview('not-an-id', reviewer.authHeader)).status).toBe(400);
  });

  it.each([
    ['rating 0', { rating: 0, text: 'x' }],
    ['rating 11', { rating: 11, text: 'x' }],
    ['fractional rating', { rating: 7.5, text: 'x' }],
    ['missing text', { rating: 5 }],
    ['text over 2000 chars', { rating: 5, text: 'a'.repeat(2001) }],
  ])('400 for %s', async (_name, body) => {
    const { reviewer, movie } = await setup();
    const res = await postReview(movie.id, reviewer.authHeader, body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /movies/:movieId/reviews', () => {
  it('is public and returns { data, page, limit, total }, newest first', async () => {
    const { reviewer, stranger, movie } = await setup();
    await postReview(movie.id, reviewer.authHeader, { rating: 5, text: 'first' });
    await postReview(movie.id, stranger.authHeader, { rating: 6, text: 'second' });

    const res = await request(app).get(`/movies/${movie.id}/reviews`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, limit: expect.any(Number), total: 2 });
    expect(res.body.data.map((r: { text: string }) => r.text)).toEqual(['second', 'first']);
  });

  it('honours page and limit', async () => {
    const { reviewer, stranger, movie } = await setup();
    await postReview(movie.id, reviewer.authHeader, { rating: 5, text: 'first' });
    await postReview(movie.id, stranger.authHeader, { rating: 6, text: 'second' });

    const res = await request(app).get(`/movies/${movie.id}/reviews?page=2&limit=1`);

    expect(res.body).toMatchObject({ page: 2, limit: 1, total: 2 });
    expect(res.body.data).toHaveLength(1);
  });

  it('returns an empty page for a movie without reviews', async () => {
    const { movie } = await setup();
    const res = await request(app).get(`/movies/${movie.id}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ data: [], total: 0 });
  });

  it('does not include reviews of other movies', async () => {
    const { owner, reviewer, movie } = await setup();
    const { body: other } = await request(app)
      .post('/movies')
      .set('Authorization', owner.authHeader)
      .send({ ...movieBody, title: 'Other' });
    await postReview(other.id, reviewer.authHeader);

    expect((await request(app).get(`/movies/${movie.id}/reviews`)).body.total).toBe(0);
  });

  it('404 for an unknown movie and 400 for a malformed id or limit', async () => {
    const { movie } = await setup();
    expect((await request(app).get(`/movies/${UNKNOWN_ID}/reviews`)).status).toBe(404);
    expect((await request(app).get('/movies/not-an-id/reviews')).status).toBe(400);
    expect((await request(app).get(`/movies/${movie.id}/reviews?limit=0`)).status).toBe(400);
  });
});

describe('GET /reviews/:id', () => {
  it('is public and returns the review', async () => {
    const { reviewer, movie } = await setup();
    const { body: created } = await postReview(movie.id, reviewer.authHeader);

    const res = await request(app).get(`/reviews/${created.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: created.id, movie: movie.id, rating: 8 });
  });

  it('404 for an unknown id and 400 for a malformed one', async () => {
    expect((await request(app).get(`/reviews/${UNKNOWN_ID}`)).status).toBe(404);
    expect((await request(app).get('/reviews/not-an-id')).status).toBe(400);
  });
});

describe('PUT /reviews/:id', () => {
  it('200 lets the author edit rating and text', async () => {
    const { reviewer, movie } = await setup();
    const { body: created } = await postReview(movie.id, reviewer.authHeader);

    const res = await request(app)
      .put(`/reviews/${created.id}`)
      .set('Authorization', reviewer.authHeader)
      .send({ rating: 3 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: created.id, rating: 3, text: 'Great movie' });
  });

  it('cannot move a review to another movie or change its author', async () => {
    const { reviewer, movie } = await setup();
    const { body: created } = await postReview(movie.id, reviewer.authHeader);

    const res = await request(app)
      .put(`/reviews/${created.id}`)
      .set('Authorization', reviewer.authHeader)
      .send({ rating: 4, movie: UNKNOWN_ID, createdBy: UNKNOWN_ID });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ movie: movie.id, createdBy: reviewer.userId, rating: 4 });
  });

  it('403 for the movie owner (only the author edits) and for a stranger', async () => {
    const { owner, reviewer, stranger, movie } = await setup();
    const { body: created } = await postReview(movie.id, reviewer.authHeader);

    for (const user of [owner, stranger]) {
      const res = await request(app)
        .put(`/reviews/${created.id}`)
        .set('Authorization', user.authHeader)
        .send({ text: 'Hacked' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
    expect((await request(app).get(`/reviews/${created.id}`)).body.text).toBe('Great movie');
  });

  it('401 without a token', async () => {
    const { reviewer, movie } = await setup();
    const { body: created } = await postReview(movie.id, reviewer.authHeader);
    expect((await request(app).put(`/reviews/${created.id}`).send({ rating: 1 })).status).toBe(401);
  });

  it('404 for an unknown review', async () => {
    const { reviewer } = await setup();
    const res = await request(app).put(`/reviews/${UNKNOWN_ID}`).set('Authorization', reviewer.authHeader).send({ rating: 1 });
    expect(res.status).toBe(404);
  });

  it('400 for an empty or invalid body', async () => {
    const { reviewer, movie } = await setup();
    const { body: created } = await postReview(movie.id, reviewer.authHeader);
    const put = (body: Record<string, unknown>) =>
      request(app).put(`/reviews/${created.id}`).set('Authorization', reviewer.authHeader).send(body);

    expect((await put({})).status).toBe(400);
    expect((await put({ rating: 11 })).status).toBe(400);
    expect((await put({ text: '' })).status).toBe(400);
  });
});

describe('DELETE /reviews/:id', () => {
  it('204 lets the author delete their review', async () => {
    const { reviewer, movie } = await setup();
    const { body: created } = await postReview(movie.id, reviewer.authHeader);

    const res = await request(app).delete(`/reviews/${created.id}`).set('Authorization', reviewer.authHeader);

    expect(res.status).toBe(204);
    expect((await request(app).get(`/reviews/${created.id}`)).status).toBe(404);
  });

  it("204 lets the movie's owner delete someone else's review", async () => {
    const { owner, reviewer, movie } = await setup();
    const { body: created } = await postReview(movie.id, reviewer.authHeader);

    const res = await request(app).delete(`/reviews/${created.id}`).set('Authorization', owner.authHeader);

    expect(res.status).toBe(204);
    expect((await request(app).get(`/reviews/${created.id}`)).status).toBe(404);
  });

  it('403 for a stranger, and the review stays', async () => {
    const { reviewer, stranger, movie } = await setup();
    const { body: created } = await postReview(movie.id, reviewer.authHeader);

    const res = await request(app).delete(`/reviews/${created.id}`).set('Authorization', stranger.authHeader);

    expect(res.status).toBe(403);
    expect((await request(app).get(`/reviews/${created.id}`)).status).toBe(200);
  });

  it("403 for the owner of a different movie (ownership is per movie)", async () => {
    const { owner, reviewer, movie } = await setup();
    const { body: otherMovie } = await request(app)
      .post('/movies')
      .set('Authorization', reviewer.authHeader)
      .send({ ...movieBody, title: 'Reviewer owns this one' });
    const { body: created } = await postReview(movie.id, owner.authHeader);
    expect(otherMovie.createdBy).toBe(reviewer.userId);

    // reviewer owns a different movie, not the one `created` belongs to
    const res = await request(app).delete(`/reviews/${created.id}`).set('Authorization', reviewer.authHeader);

    expect(res.status).toBe(403);
  });

  it('401 without a token', async () => {
    expect((await request(app).delete(`/reviews/${UNKNOWN_ID}`)).status).toBe(401);
  });

  it('404 for an unknown review and 400 for a malformed id', async () => {
    const { reviewer } = await setup();
    const del = (id: string) => request(app).delete(`/reviews/${id}`).set('Authorization', reviewer.authHeader);
    expect((await del(UNKNOWN_ID)).status).toBe(404);
    expect((await del('not-an-id')).status).toBe(400);
  });
});
