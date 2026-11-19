import request from 'supertest';
import { createApp } from '../../src/app';
import { User } from '../../src/models/User';
import { verifyToken } from '../../src/utils/jwt';
import { clearTestDb, startTestDb, stopTestDb } from '../helpers/db';

const app = createApp();

beforeAll(async () => {
  await startTestDb();
  await User.init();
});
afterEach(clearTestDb);
afterAll(stopTestDb);

const valid = { username: 'morpheus', email: 'morpheus@matrix.io', password: 'what-is-real' };

describe('POST /auth/register', () => {
  it('201 with { user, token } and never exposes the password', async () => {
    const res = await request(app).post('/auth/register').send(valid);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ id: expect.any(String), username: 'morpheus', email: 'morpheus@matrix.io' });
    expect(typeof res.body.token).toBe('string');
    expect(verifyToken(res.body.token)).toBe(res.body.user.id);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain(valid.password);
  });

  it('409 when the email is already taken', async () => {
    await request(app).post('/auth/register').send(valid);
    const res = await request(app)
      .post('/auth/register')
      .send({ ...valid, username: 'other', email: 'MORPHEUS@matrix.io' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('409 when the username is already taken', async () => {
    await request(app).post('/auth/register').send(valid);
    const res = await request(app).post('/auth/register').send({ ...valid, email: 'other@matrix.io' });
    expect(res.status).toBe(409);
  });

  it.each([
    ['missing fields', {}],
    ['invalid email', { ...valid, email: 'not-an-email' }],
    ['short password', { ...valid, password: 'short' }],
    ['short username', { ...valid, username: 'ab' }],
  ])('400 for %s', async (_name, body) => {
    const res = await request(app).post('/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/auth/register').send(valid);
  });

  it('200 with { user, token } for correct credentials', async () => {
    const res = await request(app).post('/auth/login').send({ email: valid.email, password: valid.password });
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('morpheus');
    expect(verifyToken(res.body.token)).toBe(res.body.user.id);
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('email is case-insensitive', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'Morpheus@Matrix.IO', password: valid.password });
    expect(res.status).toBe(200);
  });

  it('401 for a wrong password', async () => {
    const res = await request(app).post('/auth/login').send({ email: valid.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('401 for an unknown email, with the same message as a wrong password', async () => {
    const wrongPw = await request(app).post('/auth/login').send({ email: valid.email, password: 'wrong-password' });
    const unknown = await request(app).post('/auth/login').send({ email: 'ghost@matrix.io', password: 'whatever1' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.message).toBe(wrongPw.body.error.message);
  });

  it('400 when the body is invalid', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'nope' });
    expect(res.status).toBe(400);
  });
});
