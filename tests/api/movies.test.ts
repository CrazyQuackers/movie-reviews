import request from 'supertest';
import { createApp } from '../../src/app';
import { createUserAndToken } from '../helpers/auth';
import { clearTestDb, startTestDb, stopTestDb } from '../helpers/db';

const app = createApp();

beforeAll(startTestDb);
afterEach(clearTestDb);
afterAll(stopTestDb);

const valid = {
  title: 'The Matrix',
  releaseYear: 1999,
  genre: ['sci-fi', 'action'],
  director: 'Wachowski',
  actors: ['Keanu Reeves'],
  description: 'Wake up, Neo',
};

const UNKNOWN_ID = '507f1f77bcf86cd799439011';

async function createMovie(authHeader: string, body: Record<string, unknown> = valid) {
  return request(app).post('/movies').set('Authorization', authHeader).send(body);
}

describe('POST /movies', () => {
  it('201 creates a movie owned by the token user, ignoring createdBy in the body', async () => {
    const { userId, authHeader } = await createUserAndToken();

    const res = await createMovie(authHeader, { ...valid, createdBy: UNKNOWN_ID });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: expect.any(String), title: 'The Matrix', createdBy: userId });
  });

  it('401 without a token', async () => {
    const res = await request(app).post('/movies').send(valid);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('400 with a validation error body for invalid input', async () => {
    const { authHeader } = await createUserAndToken();
    const res = await createMovie(authHeader, { ...valid, genre: [], releaseYear: 1700 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(expect.any(Array));
  });
});

describe('GET /movies', () => {
  it('is public and returns { data, page, limit, total }', async () => {
    const { authHeader } = await createUserAndToken();
    await createMovie(authHeader);
    await createMovie(authHeader, { ...valid, title: 'Speed' });

    const res = await request(app).get('/movies');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, limit: expect.any(Number), total: 2 });
    expect(res.body.data).toHaveLength(2);
  });

  it('honours page and limit', async () => {
    const { authHeader } = await createUserAndToken();
    for (const title of ['A', 'B', 'C']) await createMovie(authHeader, { ...valid, title });

    const res = await request(app).get('/movies?page=2&limit=2');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 2, limit: 2, total: 3 });
    expect(res.body.data).toHaveLength(1);
  });

  it('400 for an invalid limit', async () => {
    const res = await request(app).get('/movies?limit=0');
    expect(res.status).toBe(400);
  });
});

describe('GET /movies/:id', () => {
  it('is public and returns the movie', async () => {
    const { authHeader } = await createUserAndToken();
    const { body: created } = await createMovie(authHeader);

    const res = await request(app).get(`/movies/${created.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: created.id, title: 'The Matrix', genre: ['sci-fi', 'action'] });
  });

  it('404 for an unknown id', async () => {
    const res = await request(app).get(`/movies/${UNKNOWN_ID}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('400 for a malformed id', async () => {
    const res = await request(app).get('/movies/not-an-id');
    expect(res.status).toBe(400);
  });
});

describe('PUT /movies/:id', () => {
  it('200 updates the movie for its owner', async () => {
    const { authHeader } = await createUserAndToken();
    const { body: created } = await createMovie(authHeader);

    const res = await request(app)
      .put(`/movies/${created.id}`)
      .set('Authorization', authHeader)
      .send({ title: 'Reloaded' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: created.id, title: 'Reloaded', director: 'Wachowski' });
  });

  it('403 for a user who does not own the movie', async () => {
    const owner = await createUserAndToken();
    const other = await createUserAndToken();
    const { body: created } = await createMovie(owner.authHeader);

    const res = await request(app)
      .put(`/movies/${created.id}`)
      .set('Authorization', other.authHeader)
      .send({ title: 'Hacked' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect((await request(app).get(`/movies/${created.id}`)).body.title).toBe('The Matrix');
  });

  it('401 without a token', async () => {
    const { authHeader } = await createUserAndToken();
    const { body: created } = await createMovie(authHeader);
    const res = await request(app).put(`/movies/${created.id}`).send({ title: 'x' });
    expect(res.status).toBe(401);
  });

  it('404 for an unknown movie', async () => {
    const { authHeader } = await createUserAndToken();
    const res = await request(app).put(`/movies/${UNKNOWN_ID}`).set('Authorization', authHeader).send({ title: 'x' });
    expect(res.status).toBe(404);
  });

  it('400 for an empty or invalid body', async () => {
    const { authHeader } = await createUserAndToken();
    const { body: created } = await createMovie(authHeader);
    const empty = await request(app).put(`/movies/${created.id}`).set('Authorization', authHeader).send({});
    const bad = await request(app)
      .put(`/movies/${created.id}`)
      .set('Authorization', authHeader)
      .send({ releaseYear: 1800 });
    expect(empty.status).toBe(400);
    expect(bad.status).toBe(400);
  });
});

describe('DELETE /movies/:id', () => {
  it('204 deletes the movie for its owner', async () => {
    const { authHeader } = await createUserAndToken();
    const { body: created } = await createMovie(authHeader);

    const res = await request(app).delete(`/movies/${created.id}`).set('Authorization', authHeader);

    expect(res.status).toBe(204);
    expect((await request(app).get(`/movies/${created.id}`)).status).toBe(404);
  });

  it('403 for a user who does not own the movie', async () => {
    const owner = await createUserAndToken();
    const other = await createUserAndToken();
    const { body: created } = await createMovie(owner.authHeader);

    const res = await request(app).delete(`/movies/${created.id}`).set('Authorization', other.authHeader);

    expect(res.status).toBe(403);
    expect((await request(app).get(`/movies/${created.id}`)).status).toBe(200);
  });

  it('401 without a token', async () => {
    const res = await request(app).delete(`/movies/${UNKNOWN_ID}`);
    expect(res.status).toBe(401);
  });

  it('404 for an unknown movie', async () => {
    const { authHeader } = await createUserAndToken();
    const res = await request(app).delete(`/movies/${UNKNOWN_ID}`).set('Authorization', authHeader);
    expect(res.status).toBe(404);
  });
});
