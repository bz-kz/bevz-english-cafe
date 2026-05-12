# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

npm-workspaces monorepo for an English-conversation cafe marketing site.

- `frontend/` — Next.js 14 App Router + TypeScript + Tailwind + Zustand. Runs on `:3000`.
- `backend/` — FastAPI on Python 3.12, managed by **uv** (not pip/poetry). Runs on `:8000`.
- `shared/types/` and `shared/constants/` — TypeScript types/config intended to be shared (only frontend imports them today).
- `terraform/` — infra for the production environment (Render + monitoring).
- `docker-compose.yml` — local dev wiring frontend + backend + Postgres 15.

The root `package.json` is the orchestrator; almost every developer command is `npm run <script>` at the repo root, which `cd`s into the right workspace. `Makefile` is a thin alias layer over those npm scripts.

## Commands

Use uv for backend Python, not pip. Use the root scripts unless you need to debug one side in isolation.

```bash
# First-time setup (installs frontend deps + uv sync for backend)
npm run setup

# Dev (docker-compose: frontend + backend + postgres)
npm run dev                 # = docker-compose up -d
npm run dev:frontend        # next dev on 0.0.0.0:3000
npm run dev:backend         # uv run uvicorn app.main:app --reload --port 8000

# Tests
npm run test                # frontend jest + backend pytest
cd frontend && npm test -- path/to/file.test.ts          # single jest file
cd frontend && npm run test:integration                  # uses jest.integration.config.js
cd frontend && npm run test:e2e                          # Playwright
cd backend && uv run pytest tests/api/test_contact.py::TestX::test_y   # single pytest

# Lint / format (ruff for python, eslint+prettier for TS)
npm run lint                # both sides
npm run format              # both sides
cd backend && uv run ruff check . && uv run ruff format .

# Alembic migrations (backend)
cd backend && uv run alembic revision --autogenerate -m "msg"
cd backend && uv run alembic upgrade head

# Local CI simulation / GitHub Actions via act
npm run ci:local            # ./scripts/local-ci.sh
npm run ci:act              # requires `npm run ci:setup-act` once
```

Backend pytest is configured (in `pyproject.toml`) with `asyncio_mode=auto` and always runs with coverage — no extra flags needed.

## Architecture

### Backend — DDD-style layering

The backend is intentionally layered. Respect the direction of dependencies (outer → inner only):

```
api/endpoints      →  services        →  domain/entities + value_objects
api/schemas        →  domain/repositories (interfaces)
                       ↑ implemented by
                   infrastructure/repositories  (SQLAlchemy)
                   infrastructure/event_bus     (in-memory pub/sub)
                   infrastructure/database      (async session)
                   infrastructure/di/container  (composition root)
```

Domain entities (`app/domain/entities/contact.py`) raise `DomainEvent`s; the `InMemoryEventBus` dispatches them to handlers registered in `infrastructure/event_handlers/`. The `Container` in `app/infrastructure/di/container.py` is the composition root, wired during `lifespan` in `app/main.py`.

**Known divergence**: `app/api/endpoints/contact.py` does NOT pull from the DI container — it builds `ContactService` inline inside `get_contact_service`. If you're adding endpoints, follow this same pattern for now (per-request wiring via FastAPI `Depends`) unless you're explicitly refactoring to use the container.

There is also a stub `app/repositories/` directory (empty `__init__.py`) — repositories live under `app/domain/repositories/` (interfaces) and `app/infrastructure/repositories/` (implementations). Don't put new files in `app/repositories/`.

### Backend — CORS and OPTIONS quirks

`app/main.py` currently overrides the configured `cors_origins` with `allow_origins=["*"]` (with `allow_credentials=False`) for debugging, and registers a catch-all `@app.options("/{path:path}")` handler. Before tightening CORS, check whether the frontend is going through Next.js rewrites (`/api/*` proxied via `next.config.js`) or hitting the backend directly.

### Frontend

Standard Next.js 14 App Router layout under `frontend/src/app/`. Cross-cutting code:

- `src/lib/api.ts` — axios instance, request/response interceptors, auth-token plumbing.
- `src/stores/` — Zustand stores (`contactStore`, `notificationStore`).
- `src/components/sections/` — page-level marketing sections composed in `app/page.tsx`.
- `src/components/forms/ContactForm.tsx` — the only real form, posts to backend `/api/v1/contacts`.

`next.config.js` proxies `/api/:path*` → `${NEXT_PUBLIC_API_URL}/api/:path*`, so frontend code can call `/api/v1/contacts` and have it land on the FastAPI backend.

**Watch**: `src/lib/api.ts` reads `NEXT_PUBLIC_API_BASE_URL`, but everywhere else (and `.env.example`, `docker-compose.yml`, `next.config.js`) uses `NEXT_PUBLIC_API_URL`. They are not the same variable. If you wire a new fetch path, prefer `NEXT_PUBLIC_API_URL` and the Next rewrite.

### Shared types

`shared/types/contact.ts` defines the wire shape, but the backend's `LessonType` enum has *more* values than the shared TS union (e.g. `online`, `business`, `toeic`). Keep them in sync if you add a value, or the frontend will fail validation.

## Conventions

- **Python**: ruff (`target-version = py312`, line-length 88, double-quote). Don't add Black/isort/flake8 — ruff covers all of it.
- **TypeScript**: ESLint (next config) + Prettier with `prettier-plugin-tailwindcss`. lint-staged + husky run on commit.
- **Comments and docstrings** in the existing code are in Japanese. Match the surrounding language when editing; don't translate existing Japanese to English unless asked.
- **Migrations**: filenames may contain Japanese (`75cadcbcfeb8_変更内容の説明.py`). Don't rename old ones; new migrations can use English slugs.

## Deployment

- Frontend → **Vercel**. Vercel root directory is `frontend/` (not the repo root) per `VERCEL_DEPLOYMENT.md`. `vercel.json` exists at the repo root but Vercel uses the per-app config.
- Backend → **Render**, configured by `render.yaml` (note: the `repo` field is a placeholder — update if creating a new service).
- Production env vars are documented in `VERCEL_DEPLOYMENT.md` and `docs/api-keys-setup-guide.md`.
