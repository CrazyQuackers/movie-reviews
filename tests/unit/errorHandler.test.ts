import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { AppError } from '../../src/errors/AppError';
import { errorHandler } from '../../src/middlewares/errorHandler';
import { validate } from '../../src/middlewares/validate';

function appWith(setup: (app: express.Express) => void) {
  const app = express();
  app.use(express.json());
  setup(app);
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('maps AppError to status and error shape', async () => {
    const app = appWith((a) =>
      a.get('/x', () => {
        throw AppError.forbidden();
      }),
    );
    const res = await request(app).get('/x');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: 'FORBIDDEN', message: expect.any(String) } });
  });

  it('maps unknown errors to 500 without leaking details', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = appWith((a) =>
      a.get('/x', () => {
        throw new Error('secret');
      }),
    );
    const res = await request(app).get('/x');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });

  it('maps malformed JSON to 400', async () => {
    const app = appWith((a) =>
      a.post('/x', (_req, res) => {
        res.sendStatus(204);
      }),
    );
    const res = await request(app).post('/x').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
  });
});

describe('validate middleware', () => {
  const schema = z.object({ title: z.string().min(1) });
  const app = appWith((a) =>
    a.post('/x', validate(schema), (req, res) => {
      res.json(req.body);
    }),
  );

  it('passes valid input', async () => {
    const res = await request(app).post('/x').send({ title: 'Alien' });
    expect(res.status).toBe(200);
  });

  it('returns 400 with details for invalid input', async () => {
    const res = await request(app).post('/x').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
  });
});
