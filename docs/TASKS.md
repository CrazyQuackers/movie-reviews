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
- [ ] **A2 Swagger**: swagger-jsdoc/ui setup at `/api-docs`, shared schemas (Error, Movie, Review, User), bearer security scheme, document auth routes. Later: audit that every route is documented.
- [ ] **A3 Cross-cutting tests/quality**: 404 handler, error-handler tests, lint/CI (GitHub Actions running tests), README with setup instructions.

## Person B
- [ ] **B1 Movie CRUD**: model, repository, service, controller, routes; ownership checks (403); validation. Tests.
- [ ] **B2 Movie search**: filters, sort, pagination on `GET /movies`. Tests.
- [ ] **B3 Review CRUD**: model with unique index, create/edit/delete/get (delete allowed for review author or movie owner), `GET /movies/:movieId/reviews`, 409 duplicate, 404 movie. Tests.
- [ ] **B4 Ratings + cascade**: aggregation for `averageRating`/`reviewCount` in movie detail and list; cascade delete reviews on movie delete. Tests.

## Joint (end)
- [ ] Full API test pass across flows (register -> create movie -> review -> rating shows -> delete cascade)
- [ ] Swagger review, README, final cleanup

## Dependency notes
- M0 blocks everyone; A1 (real auth) blocks only B's final integration, not B's start.
- Conflict hotspots: `src/app.ts` and `src/routes/index.ts`. Each person only adds their own one-line router registration.
