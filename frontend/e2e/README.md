# Frontend E2E (Playwright)

## Prerequisites
The Playwright `webServer` starts ONLY the Next.js frontend. Backend + emulators
must be up first:

```bash
docker compose up -d        # frontend :3010, backend :8010, firestore-emulator :8080
cd frontend && npm run test:e2e -- --project=chromium   # fast single-browser
cd frontend && npm run test:e2e                          # full browser matrix
```

PR-2 additionally starts a firebase-auth-emulator (:9099) and a `globalSetup`
that seeds test users/data. CI integration is intentionally out of scope (run
locally / manually).
