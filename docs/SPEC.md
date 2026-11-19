# Specification

## Decisions
- Reads (GET) are public. POST/PUT/DELETE require `Authorization: Bearer <jwt>`.
- `createdBy` (user id) is stored on every movie and review, set from the token, never from the body.
- Only the owner can PUT/DELETE a movie/review (403 otherwise). No admin role.
- Exception: a movie's owner can also DELETE any review on their movie (moderation). Only the review's author can edit it.
- One review per user per movie (unique index `movie+createdBy`, 409 on duplicate).
- Deleting a movie deletes all its reviews.
- Auth: register/login, bcrypt-hashed password, single access JWT (1h, `JWT_EXPIRES_IN`), no refresh tokens.
- Open items we chose defaults for (change by agreement): users may review their own movie; rating is an integer 1-10.

## Models
**User**: `username` (unique), `email` (unique, lowercase), `passwordHash`, timestamps. Never return `passwordHash`.
**Movie**: `title` (req), `releaseYear` (req, 1888..current+5), `genre` (string[], req, min 1), `director` (req),
`actors` (string[]), `description`, `createdBy` (ref User), timestamps.
**Review**: `movie` (ref Movie), `createdBy` (ref User), `rating` (int 1-10), `text` (req, max 2000), timestamps.

## Endpoints
| Method | Path | Auth | Owner only | Notes |
|---|---|---|---|---|
| POST | /auth/register | no | | 201 `{user, token}`; 409 if email/username taken |
| POST | /auth/login | no | | 200 `{user, token}`; 401 bad credentials |
| GET | /movies | no | | filters: `title` (partial, case-insens.), `genre`, `year`, `director`, `actor`; `sort`, `page`, `limit` |
| GET | /movies/:id | no | | includes `averageRating` (null if none), `reviewCount` |
| POST | /movies | yes | | 201 |
| PUT | /movies/:id | yes | yes | |
| DELETE | /movies/:id | yes | yes | cascades reviews; 204 |
| GET | /movies/:movieId/reviews | no | | paginated |
| POST | /movies/:movieId/reviews | yes | | 201; 409 duplicate; 404 movie missing |
| GET | /reviews/:id | no | | |
| PUT | /reviews/:id | yes | yes | only `rating`, `text` editable |
| DELETE | /reviews/:id | yes | yes | 204; allowed for the review's author OR the owner of the reviewed movie |
| GET | /api-docs | no | | Swagger UI |

List responses: `{ data: [...], page, limit, total }`. Movie list items also include `averageRating` and `reviewCount`.

## Status codes
400 validation (invalid ObjectId too), 401 missing/invalid token, 403 not owner, 404 not found, 409 conflict, 500 unexpected.
Error shape: `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }`.
