import request from 'supertest';
import { createApp } from '../../src/app';

const app = createApp();

describe('Swagger docs', () => {
  it('serves the OpenAPI spec as JSON', async () => {
    const res = await request(app).get('/api-docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
  });

  it('documents the auth and health routes', async () => {
    const { body } = await request(app).get('/api-docs.json');
    expect(body.paths).toHaveProperty('/health');
    expect(body.paths['/auth/register']).toHaveProperty('post');
    expect(body.paths['/auth/login']).toHaveProperty('post');
  });

  it('defines the shared Error/User schemas and the bearer security scheme', async () => {
    const { body } = await request(app).get('/api-docs.json');
    expect(body.components.schemas).toHaveProperty('Error');
    expect(body.components.schemas).toHaveProperty('User');
    expect(body.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' });
  });

  it('serves the Swagger UI page at /api-docs', async () => {
    const res = await request(app).get('/api-docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });
});
