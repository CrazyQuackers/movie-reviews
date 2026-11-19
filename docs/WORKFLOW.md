# Git workflow

- `main` is always green (tests pass). No direct pushes; open a PR and have the other person review.
- Branch names: `feat/<mission>-<short-name>` e.g. `feat/b1-movie-crud`, `feat/a1-auth`.
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`). Prefer test commit then implementation commit (TDD trail).
- Before opening a PR: `git pull --rebase origin main`, then `npm test` and `npm run lint`.
- Keep PRs small (one mission or sub-part). Tick the mission in `docs/TASKS.md` in the PR.
- Shared Claude context lives in git: `CLAUDE.md`, `docs/`, `.claude/settings.json`. Personal overrides go in `.claude/settings.local.json` (git-ignored).
- If you change a decision in `docs/SPEC.md`, tell the other person and update the doc in the same PR.
- Never commit `.env`, `node_modules`, `dist`, `coverage`.
