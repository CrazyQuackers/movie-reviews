# Movie-Reviews Backend

Course project (2 people). REST API for movies and reviews with JWT auth, Swagger docs, and TDD.
**Read first:** `docs/SPEC.md` (what to build), `docs/TASKS.md` (who does what), `docs/WORKFLOW.md` (git rules).

## Stack
Node.js, Express, TypeScript, MongoDB + Mongoose, JWT (jsonwebtoken + bcrypt), Zod validation,
swagger-jsdoc + swagger-ui-express (`/api-docs`), Jest + ts-jest + supertest + mongodb-memory-server.

## Planned npm scripts
`dev` (ts-node-dev), `build` (tsc), `start`, `test`, `test:unit`, `test:integration`, `test:api`, `lint`.

## Architecture (strict separation of responsibility)
```
src/
  config/        env + db connection
  models/        Mongoose schemas only (User, Movie, Review)
  repositories/  all DB queries (incl. aggregation); no HTTP knowledge
  services/      business rules (ownership, uniqueness, rating calc); no req/res
  controllers/   parse req -> call service -> send res; no business logic
  routes/        route wiring + auth/validation middleware + Swagger JSDoc
  middlewares/   requireAuth, validate, errorHandler
  validators/    Zod schemas
  errors/        AppError and subclasses
  types/         shared types (AuthRequest, DTOs)
  app.ts         express app (no listen) ; server.ts = listen + db connect
tests/
  unit/          services/utils, repositories mocked
  integration/   service + real in-memory Mongo
  api/           supertest against app
```
Dependencies flow one way: routes -> controllers -> services -> repositories -> models.

## Conventions
- TDD: write a failing test first, then the minimum code, then refactor. Every feature PR includes unit + integration/API tests.
- Errors: throw `AppError(status, code, message, details?)`; only `errorHandler` writes error responses.
  Shape: `{ "error": { "code": "...", "message": "...", "details": ... } }`.
- Validate all input with Zod in `validate` middleware; never trust `req.body`.
- Never put secrets in git. Config via `.env` (see `.env.example`).
- Every endpoint must have Swagger JSDoc on its route.
- Strict TypeScript, no `any`.

## Key rules (details in docs/SPEC.md)
- GET endpoints public; POST/PUT/DELETE need JWT; PUT/DELETE need ownership (`createdBy`), else 403.
- One review per user per movie (409). Deleting a movie deletes its reviews.
- Movie details return `averageRating` and `reviewCount`.

## Workflow
Feature branches + PR to `main`, Conventional Commits, no direct pushes to `main`. See `docs/WORKFLOW.md`.
When you finish a mission, tick it in `docs/TASKS.md` in the same PR.
