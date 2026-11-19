import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../src/middlewares/errorHandler';
import { requireAuth } from '../../src/middlewares/requireAuth';
import type { AuthRequest } from '../../src/types/auth';
import { signTestToken } from '../helpers/auth';

const app = express();
app.get('/me', requireAuth, (req, res) => {
  res.json({ id: (req as AuthRequest).user.id });
});
app.use(errorHandler);

describe('requireAuth', () => {
  it('401 without a token', async () => {
    expect((await request(app).get('/me')).status).toBe(401);
  });

  it('401 with a garbage token', async () => {
    expect((await request(app).get('/me').set('Authorization', 'Bearer nope')).status).toBe(401);
  });

  it('sets req.user for a valid token', async () => {
    const { userId, authHeader } = signTestToken();
    const res = await request(app).get('/me').set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(userId);
  });
});
