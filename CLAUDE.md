# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

npm-workspaces monorepo for an English-conversation cafe marketing site.

- `frontend/` — Next.js 14 App Router + TypeScript + Tailwind + Zustand. Runs on `:3010`.
- `backend/` — FastAPI on Python 3.12, managed by **uv** (not pip/poetry). Runs on `:8010`.
- `shared/types/` and `shared/constants/` — TypeScript types/config intended to be shared (only frontend imports them today).
- `terraform/` — HCP Terraform + Terragrunt stacks for the production environment (Vercel + GCP WIF + Firestore + Cloud Run + billing killswitch).
- `docker-compose.yml` — local dev wiring frontend + backend + Firestore Emulator (gcr.io/google.com/cloudsdktool/google-cloud-cli:emulators).

The root `package.json` is the orchestrator; almost every developer command is `npm run <script>` at the repo root, which `cd`s into the right workspace. `Makefile` is a thin alias layer over those npm scripts.

## Commands

Use uv for backend Python, not pip. Use the root scripts unless you need to debug one side in isolation.

```bash
# First-time setup (installs frontend deps + uv sync for backend)
npm run setup

# Dev (docker-compose: frontend + backend + firestore-emulator)
npm run dev                 # = docker-compose up -d
npm run dev:frontend        # next dev on 0.0.0.0:3010
npm run dev:backend         # uv run uvicorn app.main:app --reload --port 8010

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

# Local CI simulation / GitHub Actions via act
npm run ci:local            # ./scripts/local-ci.sh
npm run ci:act              # requires `npm run ci:setup-act` once
```

Backend pytest is configured (in `pyproject.toml`) with `asyncio_mode=auto` and always runs with coverage — no extra flags needed. Backend mypy is configured with `strict=true` on `app/domain` + `app/services` via `uv run mypy app/domain app/services` (broadened in Stage E4 to api+infrastructure).

## Architecture

### Backend — DDD-style layering

The backend is intentionally layered. Respect the direction of dependencies (outer → inner only):

```
api/endpoints      →  services        →  domain/entities + value_objects
api/schemas        →  domain/repositories (interfaces)
                       ↑ implemented by
                   infrastructure/repositories  (FirestoreContactRepository)
                   infrastructure/event_bus     (in-memory pub/sub)
                   infrastructure/database      (firestore_client.py — AsyncClient factory)
                   infrastructure/di/container  (composition root)
```

Domain entities (`app/domain/entities/contact.py`) raise `DomainEvent`s; the `InMemoryEventBus` dispatches them to handlers registered in `infrastructure/event_handlers/`. Domain enums live in `app/domain/enums/`. The `Container` in `app/infrastructure/di/container.py` is the composition root and holds singletons (event_bus, email_service, handlers); repositories are composed per-request in endpoint dependencies.

`app/api/endpoints/contact.py:get_contact_service` resolves `EmailService` from `container.email_service()` and constructs `FirestoreContactRepository(get_firestore_client())` + `ContactService`. Add new endpoints with the same pattern. `get_firestore_client()` returns an `AsyncClient` singleton; in dev/test it auto-detects `FIRESTORE_EMULATOR_HOST`.

The `Container._setup_services` branches `MockEmailService` (dev/test or empty SMTP_USER) vs `SMTPEmailService` (production) based on `settings.environment`.

### Backend — CORS

`app/main.py` builds an `allowed_origins` list from `settings.cors_origins` env var plus localhost variants, and adds `allow_origin_regex=r"^https://[a-z0-9-]+\.vercel\.app$"` for Vercel preview URLs. `allow_credentials=True`. No catch-all OPTIONS handler — CORSMiddleware owns preflight.

### Frontend

Standard Next.js 14 App Router layout under `frontend/src/app/`. Cross-cutting code:

- `src/lib/api.ts` — axios instance, request/response interceptors, auth-token plumbing. Uses `NEXT_PUBLIC_API_URL`.
- `src/stores/` — Zustand stores (`notificationStore`).
- `src/schemas/contact.ts` — zod schema for form validation; mirrors `backend/app/api/schemas/contact.py` Pydantic (keep in sync manually).
- `src/components/sections/` — page-level marketing sections composed in `app/page.tsx`.
- `src/components/forms/ContactForm.tsx` — the only real form; validates via the zod schema, posts to backend `/api/v1/contacts`.
- `src/data/teachers.ts` + `src/types/teacher.ts` — shared marketing data (consumed by `TeachersSection` and `TeachersGridSection`).

`next.config.js` proxies `/api/:path*` → `${NEXT_PUBLIC_API_URL}/api/:path*`. `@next/bundle-analyzer` is wired via `ANALYZE=true npm run build`.

### Shared types

`shared/types/contact.ts` is the wire shape. It has parity with the backend `LessonType` enum (7 values) and the frontend zod schema. If you add an enum value, update all four: backend Pydantic schema, backend domain enum, shared TS union, frontend zod schema. The `/sync-shared-types` slash command surfaces drifts.

## Conventions

- **Python**: ruff (`target-version = py312`, line-length 88, double-quote). Don't add Black/isort/flake8 — ruff covers all of it.
- **TypeScript**: ESLint (next config) + Prettier with `prettier-plugin-tailwindcss`. lint-staged + husky run on commit.
- **Comments and docstrings** in the existing code are in Japanese. Match the surrounding language when editing; don't translate existing Japanese to English unless asked.
- **Migrations**: filenames may contain Japanese (`75cadcbcfeb8_変更内容の説明.py`). Don't rename old ones; new migrations can use English slugs.

## Deployment

- Frontend → **Vercel**. Root directory is `frontend/`. `vercel.json` at repo root is informational; Vercel uses per-app config. Env vars are managed via HCP workspace `english-cafe-prod-vercel`'s `env_vars` HCL variable (`terraform/envs/prod/vercel/`).
- Backend → **GCP Cloud Run** (`asia-northeast1`), service `english-cafe-api`, custom domain `https://api.bz-kz.com`. Image lives in Artifact Registry `asia-northeast1-docker.pkg.dev/english-cafe-496209/english-cafe/api:<tag>`. Terraform stack: `terraform/envs/prod/cloudrun/`. **Image swaps go through `gcloud run services update`**, not terraform — the module's `lifecycle.ignore_changes` excludes `containers[0].image` so CD doesn't fight terraform.
- Data → **Firestore Native** (`asia-northeast1`), database `(default)`, `contacts` collection. `deletion_policy = "ABANDON"` on the terraform resource so a destroy can't wipe data.
- Auth → **GCP Workload Identity Federation** trusts HCP Terraform's OIDC issuer. Per-stack runner SA `hcp-terraform-runner@english-cafe-496209.iam.gserviceaccount.com`. No SA JSON keys.
- Cost cap → ¥2000/month budget; Cloud Function disables billing on the project when the threshold is crossed (`terraform/envs/prod/billing/`).
- Production bootstrap procedure (one-time): [`docs/cloud-run-bootstrap.md`](./docs/cloud-run-bootstrap.md).
