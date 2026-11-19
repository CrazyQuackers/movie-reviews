import fs from 'fs';
import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';

/**
 * OpenAPI spec built from the `@openapi` JSDoc blocks in src/routes.
 * Shared schemas and the bearer security scheme live here; route files add their own paths.
 */
export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Movie Reviews API',
      version: '0.1.0',
      description:
        'REST API for movies and reviews. GET endpoints are public; POST/PUT/DELETE need a JWT. ' +
        'Get a token from /auth/register or /auth/login, then click **Authorize** and paste it.',
    },
    tags: [
      { name: 'Auth', description: 'Register and log in' },
      { name: 'Movies', description: 'Movie CRUD and search' },
      { name: 'Reviews', description: 'Reviews and ratings' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Validation failed' },
                details: { description: 'Optional extra info (e.g. Zod validation issues)' },
              },
            },
          },
        },
      },
    },
  },
  apis: routeFiles(),
});

/**
 * Lists the route files ourselves instead of passing a glob pattern: swagger-jsdoc runs every
 * entry through `glob`, which treats Windows backslashes as escapes and silently matches nothing.
 * Exact paths with forward slashes work on every OS.
 * .ts when running with ts-node/jest, .js when running the compiled build from dist/.
 */
function routeFiles(): string[] {
  const dir = path.join(__dirname, '../routes');
  return fs
    .readdirSync(dir)
    .filter((file) => /\.(ts|js)$/.test(file) && !file.endsWith('.d.ts'))
    .map((file) => path.join(dir, file).replace(/\\/g, '/'));
}

/** Number of documented paths; logged at startup so a broken setup is easy to spot. */
export function documentedPathCount(): number {
  const spec = swaggerSpec as { paths?: Record<string, unknown> };
  return Object.keys(spec.paths ?? {}).length;
}
