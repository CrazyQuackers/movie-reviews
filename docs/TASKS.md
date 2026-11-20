# Missions

Two people: **A** (infra, auth, Swagger) and **B** (movies, reviews). Tick boxes in the same PR that finishes the mission.
Each mission follows TDD (failing test first) and includes its own tests + Swagger JSDoc.

## M0: Scaffold + shared contract (DONE, branch `feat/m0-scaffold`)
- [x] package.json, tsconfig (strict), jest config, eslint, `.env.example`, folder skeleton from CLAUDE.md
- [x] `app.ts` / `server.ts`, `config/` (env, db connect), `GET /health`
- [x] Shared contract: `AppError`, `errorHandler`, `validate` middleware, `AuthRequest` type (`req.user = {id}`),
      `requireAuth` signature, test helpers (mongodb-memory-server setup, `createUserAndToken()` helper)
- `requireAuth` already verifies `Authorization: Bearer <jwt>` with payload `{ sub: <userId> }` and sets `req.user.id`. A1 adds token signing (must use `sub`), the User model and the real test helper (replace `signTestToken` in `tests/helpers/auth.ts`).
- Test DB helper: `tests/helpers/db.ts` (`startTestDb`/`clearTestDb`/`stopTestDb`). Feature routers are mounted in `src/routes/index.ts` (one line each).

## Person A
- [x] **A1 Auth/Users**: User model, register/login, password hashing, JWT sign/verify util, real `requireAuth`. Unit + integration + API tests.
- [x] **A2 Swagger**: swagger-jsdoc/ui setup at `/api-docs`, shared schemas (Error, User), bearer security scheme, document auth routes. (Movie/Review schemas are added by B with their routes; final audit is in Joint.)
- [x] **A3 Cross-cutting tests/quality**: 404 handler, error-handler tests (incl. Mongoose CastError/ValidationError -> 400, duplicate key -> 409), lint/CI (GitHub Actions: lint, typecheck, build, tests), README with setup instructions.

## Person B
- [x] **B1 Movie CRUD**: model, repository, service, controller, routes; ownership checks (403); validation. Tests.
- [x] **B2 Movie search**: filters, sort, pagination on `GET /movies`. Tests.
- [x] **B3 Review CRUD**: model with unique index, create/edit/delete/get (delete allowed for review author or movie owner), `GET /movies/:movieId/reviews`, 409 duplicate, 404 movie. Tests.
- [x] **B4 Ratings + cascade**: aggregation for `averageRating`/`reviewCount` in movie detail and list; cascade delete reviews on movie delete. Tests.

### Swagger docs for B's routes (required in every B PR)
Swagger is already running at `/api-docs` (setup in `src/config/swagger.ts`). It reads `@openapi` JSDoc blocks from every file in `src/routes/`, so new route files are picked up automatically.
- Put an `@openapi` block directly above **every** route in `src/routes/movies.ts` / `src/routes/reviews.ts`. Copy the style of `src/routes/auth.ts`.
- Use `tags: [Movies]` or `tags: [Reviews]` (already defined).
- Protected routes (POST/PUT/DELETE) add `security: [{ bearerAuth: [] }]`, so the **Authorize** button works for them.
- Document every response code the route can return (200/201/204, 400, 401, 403, 404, 409) and use `$ref: '#/components/schemas/Error'` for error responses.
- Define the `Movie` and `Review` schemas (and list responses `{ data, page, limit, total }`) in a `components: schemas:` block at the top of your route file, like `User` in `auth.ts`. Include `averageRating` and `reviewCount` on `Movie`.
- Path params use OpenAPI style: `/movies/{id}`, not `/movies/:id`. Query filters (B2) go under `parameters` with `in: query`.
- Check before opening the PR: `npm run dev:memory`, open http://localhost:3000/api-docs, try each route with **Try it out**. The startup log prints how many paths are documented.

## Joint (end)
- [ ] Full API test pass across flows (register -> create movie -> review -> rating shows -> delete cascade)
- [ ] Swagger review, README, final cleanup

## Dependency notes
- M0 blocks everyone; A1 (real auth) blocks only B's final integration, not B's start.
- Conflict hotspots: `src/app.ts` and `src/routes/index.ts`. Each person only adds their own one-line router registration.
