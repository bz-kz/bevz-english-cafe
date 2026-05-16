# Frontend E2E (Playwright)

## Prerequisites

The Playwright `webServer` reuses the docker-compose frontend on `:3010`
(`reuseExistingServer` locally). Backend + all emulators must be up first,
including the e2e-only Firebase Auth emulator:

```bash
# Bring up the full stack and WAIT for healthchecks (firebase-auth-emulator's
# first boot runs `npm i -g firebase-tools`, ~60-90s — --wait absorbs it).
docker compose up -d --wait

# If docker-compose.yml changed, env applies only on container recreation:
docker compose up -d --force-recreate --wait frontend backend firebase-auth-emulator

cd frontend
npm run test:e2e -- --project=public     # public flows (Chromium)
npm run test:e2e -- --project=authed     # authed/booking/admin (Chromium)
npm run test:e2e                          # all projects (public + cross-browser smoke + authed)
```

## What runs

- `public` — marketing / contact / auth-pages / browse / book-unauth / smoke.
  `public-firefox` / `public-webkit` re-run `smoke` cross-browser.
- `authed` — mypage / booking / admin (real UI login fixture).

## Emulators & seeding

- `firebase-auth-emulator` (`:9099`) is an **e2e-only** docker-compose service
  (firebase-tools). The existing Firestore emulator (`:8080`) is reused.
- `e2e/global-setup.ts` runs before the suite: it pings the deps (fail-fast if
  any is down), clears the Auth emulator, then seeds two fixed accounts —
  `e2e-user@example.com` (plan `standard`) and `e2e-admin@example.com`
  (custom claim `admin:true`) — plus `users/{uid}`, a `monthly_quota` doc and
  one open `lesson_slots` row matching the backend repository schema.
- The whole e2e stack uses a single project id `demo-english-cafe` so the
  Firebase token aud/iss, the backend Firestore namespace and the seed all
  align (the docker-compose backend sets both `GOOGLE_CLOUD_PROJECT` and
  `GCP_PROJECT_ID` to it).

## CI

CI integration is intentionally out of scope — run locally / manually. The
backend-only CI does not start these emulators.
