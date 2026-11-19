# Movie Reviews API

REST API for movies and reviews, built with Node.js, Express 5, TypeScript, MongoDB (Mongoose), JWT auth and Zod validation. Documented with Swagger and developed test-first with Jest.

## Requirements

- Node.js 22 or newer (CI uses Node 24)
- npm
- MongoDB is **optional**: `npm run dev:memory` starts a local one for you

## Setup

```bash
git clone https://github.com/CrazyQuackers/movie-reviews.git
cd movie-reviews
npm install
cp .env.example .env    # Windows: copy .env.example .env
```

Edit `.env` if needed:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | Port the API listens on |
| `MONGO_URI` | `mongodb://localhost:27017/movie-reviews` | MongoDB connection string (used by `npm run dev` / `npm start`) |
| `JWT_SECRET` | `change-me` | Secret used to sign tokens. **Use a long random value outside local dev.** |
| `JWT_EXPIRES_IN` | `1h` | Token lifetime |

`.env` is git-ignored. Never commit real secrets.

## Running

| Command | What it does |
|---|---|
| `npm run dev:memory` | Easiest way to try it. Starts the API **and** a local MongoDB (no install needed). Data is kept between restarts in `~/.movie-reviews-dev-db`, MongoDB listens on `mongodb://127.0.0.1:27018/movie-reviews`. Delete that folder to start fresh. |
| `npm run dev` | Starts the API against `MONGO_URI` (needs your own MongoDB running). Restarts on file changes. |
| `npm run build` then `npm start` | Compiles to `dist/` and runs the compiled server. |

Then open **http://localhost:3000/api-docs** for the Swagger UI.

## Trying the API in Swagger

1. `POST /auth/register` → **Try it out** → **Execute**. Copy the `token` from the response.
2. Click **Authorize** (top right) and paste the token.
3. Protected endpoints (POST/PUT/DELETE) now send `Authorization: Bearer <token>`.

The raw OpenAPI spec is at `/api-docs.json`.

## Tests and quality

| Command | What it does |
|---|---|
| `npm test` | All tests (unit, integration, API) |
| `npm run test:unit` / `test:integration` / `test:api` | One group only |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check of `src`, `tests` and `scripts` |

Tests use their own throwaway in-memory MongoDB and never touch your data. The first run downloads a MongoDB binary, which can take a minute.

GitHub Actions (`.github/workflows/ci.yml`) runs lint, type check, build and tests on every pull request and on pushes to `main`.

## API overview

GET endpoints are public. POST/PUT/DELETE need `Authorization: Bearer <token>`. Only the creator of a movie or review may change or delete it (403 otherwise). Full rules: [`docs/SPEC.md`](docs/SPEC.md).

| Method | Path | Auth |
|---|---|---|
| POST | `/auth/register` | no |
| POST | `/auth/login` | no |
| GET | `/movies`, `/movies/:id` | no |
| POST | `/movies` | yes |
| PUT / DELETE | `/movies/:id` | owner |
| GET | `/movies/:movieId/reviews`, `/reviews/:id` | no |
| POST | `/movies/:movieId/reviews` | yes |
| PUT | `/reviews/:id` | review author |
| DELETE | `/reviews/:id` | review author or movie owner |

All errors share one shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Validation failed", "details": [] } }
```

Codes: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `INTERNAL_ERROR` (500).

## Project structure

```
src/
  config/        env, db connection, Swagger setup
  models/        Mongoose schemas
  repositories/  database queries
  services/      business rules
  controllers/   request -> service -> response
  routes/        routes, middleware and Swagger JSDoc
  middlewares/   requireAuth, validate, errorHandler
  validators/    Zod schemas
  errors/        AppError
  utils/         JWT helpers
tests/           unit / integration / api
scripts/         dev-memory.ts (local dev database)
docs/            SPEC, TASKS, WORKFLOW
```

## Contributing

Feature branches and PRs to `main`, Conventional Commits, test first. See [`docs/WORKFLOW.md`](docs/WORKFLOW.md) and [`docs/TASKS.md`](docs/TASKS.md).
