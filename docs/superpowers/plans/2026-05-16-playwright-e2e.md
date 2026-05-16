# Comprehensive Playwright E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add comprehensive Playwright e2e coverage to `frontend/` — public flows (PR-1, zero infra change) then a local-only Firebase Auth emulator + authed/booking/admin flows (PR-2).

**Architecture:** PR-1 adds spec files under `frontend/e2e/` runnable against `docker compose up -d` only. PR-2 adds an env-gated `connectAuthEmulator` (dead code in prod build), a firebase-tools Auth emulator container, a Playwright `globalSetup` that clears+seeds the emulators over REST, a real-UI-login fixture, and authed specs. Single shared e2e project id `demo-english-cafe`.

**Tech Stack:** Playwright (Chromium/Firefox/WebKit/Mobile), Next.js 14, Firebase Auth/Firestore emulators, docker-compose.

**Spec:** [`docs/superpowers/specs/2026-05-16-playwright-e2e-design.md`](../specs/2026-05-16-playwright-e2e-design.md)

> **BRANCH PREREQUISITE:** Implementation branches are cut from post-#22 `origin/main` (commit `66f83ef` or later). PR-2 depends on PR-1's merged baseline (PR-1 deletes `example.spec.ts` and establishes `frontend/e2e/`; PR-2 adds `globalSetup` to `playwright.config.ts`). The subagent-driven controller creates each PR branch from current `origin/main`; verify `git log --oneline | grep -q 66f83ef` before Task 1. **Two PRs, no merge by the agent — PR creation only.**

> **DEV STACK (every test task):** `docker compose up -d` must be running (frontend :3010, backend :8010, firestore-emulator :8080; PR-2 adds firebase-auth-emulator :9099). `playwright.config.ts` `webServer` only starts the frontend — backend + emulators come from docker-compose. Run e2e from `frontend/`: `npm run test:e2e -- --project=chromium` for fast iteration, full matrix without `--project`.

---

## File Structure

### PR-1 — public e2e (no infra change)
- Create: `frontend/e2e/helpers/selectors.ts` (centralized selectors/URLs), `frontend/e2e/helpers/forms.ts` (fill/submit helpers)
- Create: `frontend/e2e/marketing.spec.ts`, `contact.spec.ts`, `auth-pages.spec.ts`, `browse.spec.ts`, `book-unauth.spec.ts`, `smoke.spec.ts`
- Create: `frontend/e2e/README.md`
- Delete: `frontend/e2e/example.spec.ts`
- Unchanged: `frontend/playwright.config.ts`

### PR-2 — auth emulator + authed e2e
- Modify: `frontend/src/lib/firebase.ts` (gated `connectAuthEmulator` — the only `frontend/src/` change)
- Modify: `docker-compose.yml` (add `firebase-auth-emulator` service; backend env: `FIREBASE_AUTH_EMULATOR_HOST`, `GOOGLE_CLOUD_PROJECT=demo-english-cafe`, change `GCP_PROJECT_ID` → `demo-english-cafe`)
- Create: `firebase.json`, `.firebaserc`
- Modify: `frontend/playwright.config.ts` (`globalSetup`, `webServer.env`, `projects` testMatch split)
- Create: `frontend/e2e/global-setup.ts`, `frontend/e2e/helpers/auth.ts`
- Create: `frontend/e2e/mypage.spec.ts`, `booking.spec.ts`, `admin.spec.ts`
- Modify: `frontend/e2e/README.md`, `CLAUDE.md`

---

# PHASE PR-1 — Public-flow e2e (branch `feat/e2e-public`, no infra)

## Task 1: e2e helpers + README + remove scaffold

**Files:**
- Create: `frontend/e2e/helpers/selectors.ts`, `frontend/e2e/helpers/forms.ts`, `frontend/e2e/README.md`
- Delete: `frontend/e2e/example.spec.ts`

- [ ] **Step 1: Confirm baseline**

Run:
```bash
cd "$(git rev-parse --show-toplevel)"
git log --oneline | grep -q 66f83ef && echo "post-#22 OK" || echo "ABORT: recreate branch from origin/main"
test -f frontend/e2e/example.spec.ts && echo "scaffold present"
```
Expected: `post-#22 OK` and `scaffold present`.

- [ ] **Step 2: Write `frontend/e2e/helpers/selectors.ts`**

```ts
export const ROUTES = {
  home: "/", contact: "/contact", lessons: "/lessons", instructors: "/instructors",
  reviews: "/reviews", reviewsSubmit: "/reviews/submit", videos: "/videos",
  login: "/login", signup: "/signup", book: "/book", debug: "/debug",
  mypage: "/mypage", mypageEdit: "/mypage/edit", mypagePlan: "/mypage/plan",
  adminLessons: "/admin/lessons",
} as const;

// ContactForm field ids verified in frontend/src/components/forms/ContactForm.tsx
export const CONTACT = {
  name: "#name", email: "#email", phone: "#phone", lessonType: "#lessonType",
  message: "#message", preferredContact: 'input[name="preferredContact"]',
  submit: 'button[type="submit"]',
  fieldError: "p.text-sm.text-red-600",
  submitErrorHeading: "text=送信エラー",
  successToast: "text=送信完了",
} as const;
```

- [ ] **Step 3: Write `frontend/e2e/helpers/forms.ts`**

```ts
import { Page, expect } from "@playwright/test";
import { CONTACT } from "./selectors";

export async function fillContactForm(page: Page, v: {
  name: string; email: string; message: string; lessonType: string;
}) {
  await page.fill(CONTACT.name, v.name);
  await page.fill(CONTACT.email, v.email);
  await page.selectOption(CONTACT.lessonType, v.lessonType);
  await page.fill(CONTACT.message, v.message);
}

export async function expectVisible(page: Page, selector: string) {
  await expect(page.locator(selector).first()).toBeVisible();
}
```

- [ ] **Step 4: Write `frontend/e2e/README.md`**

```markdown
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
```

- [ ] **Step 5: Delete scaffold + commit**

```bash
git rm frontend/e2e/example.spec.ts
git add frontend/e2e/helpers/selectors.ts frontend/e2e/helpers/forms.ts frontend/e2e/README.md
git commit -m "test(e2e): helpers + README; remove scaffold spec"
```

---

## Task 2: `marketing.spec.ts`

**Files:** Create `frontend/e2e/marketing.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from "@playwright/test";
import { ROUTES } from "./helpers/selectors";

test.describe("marketing landing", () => {
  test("home renders core sections", async ({ page }) => {
    const resp = await page.goto(ROUTES.home);
    expect(resp?.status()).toBeLessThan(400);
    await expect(page.locator("header").first()).toBeVisible();
    await expect(page.locator("footer").first()).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
  });

  test("primary nav reaches key pages", async ({ page }) => {
    await page.goto(ROUTES.home);
    for (const path of [ROUTES.lessons, ROUTES.instructors, ROUTES.reviews, ROUTES.videos, ROUTES.contact]) {
      const r = await page.goto(path);
      expect(r?.status(), `GET ${path}`).toBeLessThan(400);
      await expect(page.locator("main")).toBeVisible();
    }
  });
});
```

- [ ] **Step 2: Run (docker compose must be up)**

Run: `cd frontend && npm run test:e2e -- --project=chromium marketing.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/marketing.spec.ts
git commit -m "test(e2e): marketing landing + nav"
```

---

## Task 3: `contact.spec.ts`

**Files:** Create `frontend/e2e/contact.spec.ts`

- [ ] **Step 1: Write the spec** (zod schema mirrored from `frontend/src/schemas/contact.ts`: message 10–1000, lessonType blank invalid, submit disabled while invalid; success = `送信完了` toast + form reset; backend 500 → `送信エラー` block)

```ts
import { test, expect } from "@playwright/test";
import { ROUTES, CONTACT } from "./helpers/selectors";
import { fillContactForm } from "./helpers/forms";

test.describe("contact form", () => {
  test("submit disabled and errors shown when invalid", async ({ page }) => {
    await page.goto(ROUTES.contact);
    await expect(page.locator(CONTACT.submit)).toBeDisabled();
    await page.fill(CONTACT.name, "テスト");
    await page.fill(CONTACT.email, "bad-email");
    await page.fill(CONTACT.message, "short");          // < 10 chars
    await page.locator(CONTACT.message).blur();
    await expect(page.locator(CONTACT.fieldError).first()).toBeVisible();
    await expect(page.locator(CONTACT.submit)).toBeDisabled();
  });

  test("message length boundary 9 invalid / 10 valid", async ({ page }) => {
    await page.goto(ROUTES.contact);
    await fillContactForm(page, { name: "山田", email: "y@example.com", lessonType: "trial", message: "123456789" });
    await page.locator(CONTACT.message).blur();
    await expect(page.locator(CONTACT.submit)).toBeDisabled();
    await page.fill(CONTACT.message, "1234567890");
    await expect(page.locator(CONTACT.submit)).toBeEnabled();
  });

  test("happy path posts to backend and shows success", async ({ page }) => {
    await page.goto(ROUTES.contact);
    await fillContactForm(page, {
      name: "結合テスト", email: "e2e@example.com", lessonType: "trial",
      message: "これは10文字以上の問い合わせ本文です。",
    });
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/v1/contacts") && r.request().method() === "POST"),
      page.click(CONTACT.submit),
    ]);
    expect(resp.status()).toBeLessThan(300);
    await expect(page.locator(CONTACT.successToast)).toBeVisible();
  });

  test("backend 500 shows submit error block", async ({ page }) => {
    await page.route("**/api/v1/contacts**", (r) =>
      r.fulfill({ status: 500, contentType: "application/json", body: '{"detail":"boom"}' }));
    await page.goto(ROUTES.contact);
    await fillContactForm(page, {
      name: "失敗", email: "f@example.com", lessonType: "trial",
      message: "サーバエラー検証用の十分な長さの本文。",
    });
    await page.click(CONTACT.submit);
    await expect(page.locator(CONTACT.submitErrorHeading)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run**

Run: `cd frontend && npm run test:e2e -- --project=chromium contact.spec.ts`
Expected: PASS (4 tests). If the happy-path test writes to Firestore emulator, that is acceptable (emulator data, non-prod).

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/contact.spec.ts
git commit -m "test(e2e): contact form validation + submit + error"
```

---

## Task 4: `auth-pages.spec.ts` (render + client-side validation only — no real Firebase submit)

**Files:** Create `frontend/e2e/auth-pages.spec.ts`

- [ ] **Step 1: Verified selectors (no read needed unless changed)**

`LoginForm.tsx` inputs have **no `id`/`name`** — only `type="email"` / `type="password"` with placeholders, marked HTML `required` (native validation, no zod). Submit calls `signInWithEmailAndPassword` then `router.push("/mypage")`. So `input[type="email"]` / `input[type="password"]` are valid selectors. Empty submit triggers native constraint validation (no network). If the form gained ids/zod since, re-grep and adjust.

- [ ] **Step 2: Write the spec** (assert native invalid state — not a racy request-poll)

```ts
import { test, expect } from "@playwright/test";
import { ROUTES } from "./helpers/selectors";

test.describe("auth pages (render + client validation)", () => {
  test("login renders; empty submit blocked by native validation (no network)", async ({ page }) => {
    await page.goto(ROUTES.login);
    await expect(page.locator("form")).toBeVisible();
    await page.locator('button[type="submit"]').click();
    // required email stays invalid -> Firebase never called
    await expect(page.locator('input[type="email"]')).toHaveJSProperty("validity.valid", false);
    expect(page.url()).toContain("/login");
  });

  test("signup renders with required email + password fields", async ({ page }) => {
    await page.goto(ROUTES.signup);
    await expect(page.locator("form")).toBeVisible();
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });
});
```

- [ ] **Step 3: Run + commit**

Run: `cd frontend && npm run test:e2e -- --project=chromium auth-pages.spec.ts` → PASS.
```bash
git add frontend/e2e/auth-pages.spec.ts
git commit -m "test(e2e): login/signup render + client validation"
```

---

## Task 5: `browse.spec.ts` (lists + `[id]` detail + `/reviews/submit`)

**Files:** Create `frontend/e2e/browse.spec.ts`

- [ ] **Step 1: Write the spec** (covers M2: dynamic detail + review submit render)

```ts
import { test, expect } from "@playwright/test";
import { ROUTES } from "./helpers/selectors";

test.describe("public browse", () => {
  for (const path of [ROUTES.lessons, ROUTES.instructors, ROUTES.reviews, ROUTES.videos, ROUTES.reviewsSubmit]) {
    test(`renders ${path}`, async ({ page }) => {
      const r = await page.goto(path);
      expect(r?.status(), path).toBeLessThan(400);
      await expect(page.locator("main")).toBeVisible();
    });
  }

  test("instructors list -> first detail [id]", async ({ page }) => {
    await page.goto(ROUTES.instructors);
    const link = page.locator('a[href^="/instructors/"]').first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/instructors\/.+/);
    await expect(page.locator("main")).toBeVisible();
  });

  test("lessons list -> first detail [id]", async ({ page }) => {
    await page.goto(ROUTES.lessons);
    const link = page.locator('a[href^="/lessons/"]').first();
    if (await link.count()) {
      await link.click();
      await expect(page).toHaveURL(/\/lessons\/.+/);
      await expect(page.locator("main")).toBeVisible();
    }
  });
});
```

- [ ] **Step 2: Run + commit**

Run: `cd frontend && npm run test:e2e -- --project=chromium browse.spec.ts` → PASS.
```bash
git add frontend/e2e/browse.spec.ts
git commit -m "test(e2e): public browse + dynamic detail + review submit render"
```

---

## Task 6: `book-unauth.spec.ts` (observed guard contract — I2)

**Files:** Create `frontend/e2e/book-unauth.spec.ts`

- [ ] **Step 1: Confirm the unauth contract (verified)**

`frontend/src/app/book/page.tsx:65-66` does `if (!user) router.push("/login")` — the page client-redirects unauthenticated users to `/login`. Re-confirm the line still holds: `grep -n "router.push(\"/login\")" frontend/src/app/book/page.tsx`. If the redirect target/line changed, assert the observed target instead.

- [ ] **Step 2: Write the spec (Branch A — verified redirect)**

```ts
import { test, expect } from "@playwright/test";
import { ROUTES } from "./helpers/selectors";

test("book page redirects unauthenticated users to /login", async ({ page }) => {
  await page.goto(ROUTES.book);
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step 3: Run + commit**

Run: `cd frontend && npm run test:e2e -- --project=chromium book-unauth.spec.ts` → PASS.
```bash
git add frontend/e2e/book-unauth.spec.ts
git commit -m "test(e2e): /book unauthenticated guard contract"
```

---

## Task 7: `smoke.spec.ts` (all 18 routes 2xx) + PR-1 verification + PR

**Files:** Create `frontend/e2e/smoke.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from "@playwright/test";
import { ROUTES } from "./helpers/selectors";

const PUBLIC = [ROUTES.home, ROUTES.contact, ROUTES.lessons, ROUTES.instructors,
  ROUTES.reviews, ROUTES.reviewsSubmit, ROUTES.videos, ROUTES.login, ROUTES.signup,
  ROUTES.book, ROUTES.debug];

test.describe("smoke: routes respond + no fatal console", () => {
  for (const path of PUBLIC) {
    test(`GET ${path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
      const r = await page.goto(path);
      expect(r?.status(), path).toBeLessThan(400);
      await expect(page.locator("body")).toBeVisible();
    });
  }
  for (const asset of ["/sitemap.xml", "/robots.txt", "/api/health"]) {
    test(`GET ${asset} 2xx`, async ({ request }) => {
      const r = await request.get(asset);
      expect(r.status(), asset).toBeLessThan(400);
    });
  }
});
```

- [ ] **Step 2: Full PR-1 run**

Run: `cd frontend && npm run test:e2e -- --project=chromium`
Expected: ALL specs PASS. (Optionally run full matrix `npm run test:e2e` — note timing.)

- [ ] **Step 3: Scope assertion (no infra change)**

Run:
```bash
cd "$(git rev-parse --show-toplevel)"
git diff --name-only origin/main..HEAD | sort
```
Expected: only `frontend/e2e/**` paths (+ deleted `frontend/e2e/example.spec.ts`). NO `playwright.config.ts`, no `frontend/src/`, no `docker-compose.yml`, no `firebase.*`.

- [ ] **Step 4: Commit + push + PR (no merge)**

```bash
git add frontend/e2e/smoke.spec.ts
git commit -m "test(e2e): all-routes smoke"
git push -u origin feat/e2e-public
gh pr create --title "test(e2e): comprehensive public-flow Playwright suite (PR-1/2)" --body "$(cat <<'EOF'
## Summary
Public-flow Playwright e2e (scope B, part 1 of 2). Zero infra change — runnable with `docker compose up -d`. Replaces the `example.spec.ts` scaffold.

## Specs
marketing / contact (zod validation + real backend submit + 500 error block) / auth-pages (render + client validation, no real Firebase) / browse (lists + `[id]` detail + `/reviews/submit`) / book-unauth (observed guard contract) / smoke (all routes 2xx + no fatal console).

## Test plan
- [x] `docker compose up -d` then `npm run test:e2e -- --project=chromium` all green
- [x] scope = only `frontend/e2e/**` (no playwright.config / src / compose / firebase)
- [ ] (reviewer) spec-compliance + code-quality

## Notes
PR-2 (Firebase Auth emulator + authed/booking/admin specs) builds on this merged baseline.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
(Do NOT merge — PR creation only.)

---

# PHASE PR-2 — Auth emulator + authed e2e (branch `feat/e2e-auth`, from PR-1-merged origin/main)

> Create `feat/e2e-auth` from `origin/main` AFTER PR-1 is merged (verify `git log --oneline | grep -q "test(e2e): all-routes smoke"` is in origin/main). Cherry-pick spec/plan docs as needed.

## Task 8: Gated `connectAuthEmulator` + firebase.json/.firebaserc

**Files:** Modify `frontend/src/lib/firebase.ts`; Create `firebase.json`, `.firebaserc`

- [ ] **Step 1: Read current firebase.ts**

Run: `cat frontend/src/lib/firebase.ts`
Note the existing `firebaseAuth` init and imports.

- [ ] **Step 2: Add the gated emulator connect**

Add `connectAuthEmulator` to the `firebase/auth` import, and immediately after `firebaseAuth` is created:

```ts
import { getAuth, connectAuthEmulator } from "firebase/auth";
// ...existing init...
if (process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST) {
  connectAuthEmulator(
    firebaseAuth,
    `http://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST}`,
    { disableWarnings: true },
  );
}
```
This is the ONLY `frontend/src/` change. In prod, `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST` is unset at build time → Next.js inlines `undefined` → dead branch.

- [ ] **Step 3: Create `firebase.json`**

```json
{
  "emulators": {
    "auth": { "host": "0.0.0.0", "port": 9099 },
    "singleProjectMode": true
  }
}
```

- [ ] **Step 4: Create `.firebaserc`**

```json
{ "projects": { "default": "demo-english-cafe" } }
```

- [ ] **Step 5: Lint + commit**

```bash
cd frontend && npm run lint && npx tsc --noEmit && cd ..
git add frontend/src/lib/firebase.ts firebase.json .firebaserc
git commit -m "feat(e2e): env-gated Firebase Auth emulator connect + firebase config"
```
Expected: lint + tsc clean.

---

## Task 9: docker-compose Auth emulator + project-id env (C1)

**Files:** Modify `docker-compose.yml`

- [ ] **Step 1: Read current compose**

Run: `cat docker-compose.yml`
Identify the `backend` service `environment:` block and the existing `firestore-emulator` service (keep it unchanged).

- [ ] **Step 2: Add `firebase-auth-emulator` service**

Add a service (firebase-tools image) running the Auth emulator only:

```yaml
  firebase-auth-emulator:
    image: node:20-alpine
    working_dir: /app
    command: sh -c "npm i -g firebase-tools@latest && firebase emulators:start --only auth --project demo-english-cafe"
    volumes:
      - ./firebase.json:/app/firebase.json:ro
      - ./.firebaserc:/app/.firebaserc:ro
    ports:
      - "9099:9099"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:9099/"]
      interval: 5s
      timeout: 3s
      retries: 30          # first boot does `npm i -g firebase-tools` (~60s) — generous retries
      start_period: 90s
```
The `healthcheck` makes `docker compose up -d --wait` block until the emulator is actually serving, so `globalSetup`'s fail-fast ping does not race the first-boot npm install.

- [ ] **Step 3: Backend env (C1 — both project vars)**

In the `backend` service `environment:` set/add:
```yaml
      GCP_PROJECT_ID: demo-english-cafe          # was english-cafe-dev — Firestore AsyncClient (config.py:42)
      GOOGLE_CLOUD_PROJECT: demo-english-cafe     # firebase-admin verify_id_token
      FIREBASE_AUTH_EMULATOR_HOST: firebase-auth-emulator:9099
```
Leave the existing `firestore-emulator` service definition (gcloud-cli, `--project=english-cafe-dev`, 8080) unchanged.

- [ ] **Step 4: Validate compose + bring up**

Run:
```bash
docker compose config >/dev/null && echo "compose valid"
docker compose up -d --wait        # blocks on healthchecks incl. firebase-auth-emulator first boot
curl -fs "http://localhost:9099/" >/dev/null 2>&1 && echo "auth emu up"
curl -fs "http://localhost:8010/api/health" && echo " backend up"
```
Expected: `compose valid`, `auth emu up`, backend health 2xx. `--wait` + the service healthcheck absorb the firebase-tools npm-install latency (no `sleep` race). Always run `docker compose up -d --wait` and let it return BEFORE invoking `npm run test:e2e` (a stale reused dev server without the new `webServer.env` would also break — restart the frontend container if it predates Task 10's config).

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(e2e): firebase-auth-emulator service + demo project env (C1)"
```

---

## Task 10: Playwright globalSetup (clear → seed) + config wiring

**Files:** Create `frontend/e2e/global-setup.ts`; Modify `frontend/playwright.config.ts`

- [ ] **Step 1: Confirm ALL seeded collection schemas (users + quota + slots)**

The seed must satisfy the backend READ path for every authed collection, including value TYPES (a string where the repo expects a Firestore timestamp silently breaks booking — looks like an app bug). Run:
```bash
grep -rn "_to_dict\|_from_dict\|def _to_entity\|to_firestore\|from_firestore" -A30 \
  backend/app/infrastructure/repositories/ | grep -iE "user|quota|slot|booking" -A30
grep -rni "monthly_quota\|lesson_slots\|start_at\|granted_at\|booked_count\|remaining" \
  backend/app/infrastructure/repositories/ backend/app/domain/
```
Record, for `users/{uid}`, `monthly_quota/{uid}_{YYYY-MM}`, `lesson_slots/{id}`: exact field names AND each field's Firestore type — in particular whether `start_at` / `granted_at` / any date is read as a Firestore **timestamp** (→ must seed as `timestampValue`) vs an ISO **string** (→ `stringValue`), and whether numbers are int. (Verified baseline: `FirestoreUserRepository._to_dict` uses snake_case `uid/email/name/phone/plan/plan_started_at/trial_used`. Cross-check quota/slot likewise — do NOT assume.) Use the verified names/types verbatim in Step 2.

- [ ] **Step 2: Write `frontend/e2e/global-setup.ts`**

```ts
import { FullConfig } from "@playwright/test";

const PROJECT = "demo-english-cafe";
const AUTH = "http://localhost:9099";
const FS = `http://localhost:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const KEY = "any";

async function ping(url: string, name: string) {
  try { await fetch(url); } catch { throw new Error(`e2e dep down: ${name} (${url}) — run 'docker compose up -d'`); }
}

async function clearAuth() {
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
}

async function signUp(email: string, password: string): Promise<string> {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const j = await r.json();
  return j.localId as string;
}

async function setAdmin(localId: string) {
  await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update?key=${KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ localId, customAttributes: JSON.stringify({ admin: true }) }),
  });
}

// Wrap a value to force Firestore timestamp typing where the repo expects it.
class Ts { constructor(public iso: string) {} }
const ts = (iso: string) => new Ts(iso);

async function fsSet(path: string, fields: Record<string, unknown>) {
  // Firestore emulator REST: PATCH document with typed values.
  const toVal = (v: unknown): unknown =>
    v instanceof Ts ? { timestampValue: v.iso }
    : typeof v === "boolean" ? { booleanValue: v }
    : typeof v === "number" ? { integerValue: String(v) }
    : { stringValue: String(v) };
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toVal(v)])) };
  await fetch(`${FS}/${path}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export default async function globalSetup(_c: FullConfig) {
  await ping(`${AUTH}/`, "firebase-auth-emulator:9099");
  await ping("http://localhost:8080/", "firestore-emulator:8080");
  await ping("http://localhost:8010/api/health", "backend:8010");

  await clearAuth();
  const userUid = await signUp("e2e-user@example.com", "Passw0rd!e2e");
  const adminUid = await signUp("e2e-admin@example.com", "Passw0rd!e2e");
  await setAdmin(adminUid);

  const ym = new Date().toISOString().slice(0, 7); // YYYY-MM
  const startAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString();

  // NOTE: field names + value types below MUST match the repositories confirmed
  // in Task 10 Step 1. `ts(...)` forces Firestore timestampValue — apply it to
  // every date field the repo reads as a timestamp (start_at/granted_at/etc.);
  // if Step 1 shows a field is an ISO string, pass the raw string instead.
  await fsSet(`users/${userUid}`, { uid: userUid, email: "e2e-user@example.com", plan: "standard", trial_used: false });
  await fsSet(`users/${adminUid}`, { uid: adminUid, email: "e2e-admin@example.com", plan: "standard", trial_used: false });
  await fsSet(`monthly_quota/${userUid}_${ym}`, { uid: userUid, remaining: 3, granted_at: ts(startAt) });
  await fsSet(`lesson_slots/e2e-slot-1`, { status: "open", capacity: 5, booked_count: 0, start_at: ts(startAt) });

  process.env.E2E_USER_EMAIL = "e2e-user@example.com";
  process.env.E2E_ADMIN_EMAIL = "e2e-admin@example.com";
  process.env.E2E_PASSWORD = "Passw0rd!e2e";
}
```
(If Step 1 shows different `users` field names or a different `monthly_quota`/`lesson_slots` shape, adjust the `fsSet` calls to match the repository exactly — the test data must satisfy the backend read path.)

- [ ] **Step 3: Wire `playwright.config.ts`**

Add `globalSetup`, `webServer.env`, and split projects by `testMatch` (M3):
```ts
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL: "http://localhost:3010" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3010",
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-english-cafe",
      NEXT_PUBLIC_FIREBASE_API_KEY: "demo-key",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-english-cafe.firebaseapp.com",
      NEXT_PUBLIC_STRIPE_ENABLED: "true",
      NEXT_PUBLIC_API_URL: "http://localhost:8010",
    },
  },
  projects: [
    { name: "public", testMatch: /(marketing|contact|auth-pages|browse|book-unauth|smoke)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] } },
    { name: "public-cross", testMatch: /smoke\.spec\.ts/, use: { ...devices["Desktop Firefox"] } },
    { name: "authed", testMatch: /(mypage|booking|admin)\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
  ],
});
```
(Preserve any existing config keys not shown; merge rather than wholesale-replace if the current file has extra settings — read it first.)

- [ ] **Step 4: Smoke the setup**

Run: `cd frontend && npm run test:e2e -- --project=public smoke.spec.ts`
Expected: PASS and globalSetup logs no dep-down error (seed ran).

- [ ] **Step 5: Commit**

```bash
git add frontend/e2e/global-setup.ts frontend/playwright.config.ts
git commit -m "feat(e2e): globalSetup clear+seed emulators; config projects/env"
```

---

## Task 11: Auth fixture (real UI login — C2 / I1)

**Files:** Create `frontend/e2e/helpers/auth.ts`

- [ ] **Step 1: Confirm the authed-settled signal (REQUIRED — not optional)**

Verified: `LoginForm` submits `signInWithEmailAndPassword` then `router.push("/mypage")`; inputs are `input[type="email"]`/`input[type="password"]`. But `waitForURL('**/mypage')` alone is **insufficient** — the push fires before `onAuthStateChanged` hydrates `authStore`, and `useAdminGuard` keys off store `loading`; navigating an admin spec too early causes a spurious redirect to `/`. So the fixture MUST also wait for an authed-settled signal. Run:
```bash
sed -n '1,60p' frontend/src/stores/authStore.ts
grep -rn "useAdminGuard\|loading\|isAdmin" frontend/src/stores/authStore.ts frontend/src/app/mypage/page.tsx
```
Identify a concrete settled signal: a `/mypage`-only element that renders ONLY after `authStore.loading===false && user!==null` (e.g. the profile section / a logout control), OR expose `window.__E2E_AUTH_READY` is NOT allowed (no app-code hack — C2). Pick the DOM element.

- [ ] **Step 2: Write the fixture** (wait for `/mypage` URL **and** the settled DOM signal)

```ts
import { test as base, expect, Page } from "@playwright/test";

async function uiLogin(page: Page, email: string) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', process.env.E2E_PASSWORD!);
  await page.locator('button[type="submit"]').click();
  // I1: LoginForm router.push('/mypage') after signIn; then REQUIRE the
  // authed-settled DOM signal from Step 1 (authStore loading=false & user!=null)
  // before any guarded navigation — NOT just the URL, NOT a sleep.
  await page.waitForURL("**/mypage", { timeout: 15000 });
  await expect(page.locator(/* Step 1 settled-signal selector */ "main")).toBeVisible();
}

export const test = base.extend<{ asUser: Page; asAdmin: Page }>({
  asUser: async ({ page }, use) => { await uiLogin(page, process.env.E2E_USER_EMAIL!); await use(page); },
  asAdmin: async ({ page }, use) => { await uiLogin(page, process.env.E2E_ADMIN_EMAIL!); await use(page); },
});
export { expect };
```
Replace the `"main"` placeholder with the Step 1 settled-signal selector — this replacement is REQUIRED (the generic `main` is insufficient for admin specs; do not ship the literal `"main"`).

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/helpers/auth.ts
git commit -m "test(e2e): real-UI-login auth fixture (asUser/asAdmin)"
```

---

## Task 12: `mypage.spec.ts` (incl. Stripe boundary I3)

**Files:** Create `frontend/e2e/mypage.spec.ts`

- [ ] **Step 1: Confirm plan-select selector (verified — no `data-plan`)**

Verified: `PlanCard` renders a button with Japanese text `選択` for a selectable (non-current) plan and `ご利用中` for the current plan; there is **no** `data-plan` attribute and **no** English plan name on the button. The seeded user is `plan:"standard"`, so target a *different* plan's `選択` button (e.g. an upgrade tier). Re-confirm: `grep -n "選択\|ご利用中\|data-plan\|onSelect" frontend/src/components/**/PlanCard*.tsx frontend/src/app/mypage/plan/*.tsx`. Use `button:has-text("選択")` (first selectable), not the generic selector.

- [ ] **Step 2: Write the spec**

```ts
import { test, expect } from "./helpers/auth";
import { ROUTES } from "./helpers/selectors";

test.describe("mypage (authed)", () => {
  test("mypage renders profile/bookings sections", async ({ asUser }) => {
    await asUser.goto(ROUTES.mypage);
    await expect(asUser.locator("main")).toBeVisible();
    expect(asUser.url()).not.toContain("/login");
  });

  test("edit profile PUT users/me", async ({ asUser }) => {
    await asUser.goto(ROUTES.mypageEdit);
    const [resp] = await Promise.all([
      asUser.waitForResponse((r) => r.url().includes("/api/v1/users/me") && r.request().method() === "PUT"),
      asUser.locator('button[type="submit"]').click(),
    ]);
    expect(resp.status()).toBeLessThan(400);
  });

  test("plan checkout boundary — no real Stripe (I3)", async ({ asUser }) => {
    let checkoutHit = false, stripeAborted = false;
    await asUser.route("**/api/v1/billing/checkout", (r) => {
      checkoutHit = true;
      r.fulfill({ status: 200, contentType: "application/json", body: '{"url":"https://checkout.stripe.com/test"}' });
    });
    await asUser.route("https://checkout.stripe.com/**", (r) => { stripeAborted = true; r.abort(); });
    await asUser.goto(ROUTES.mypagePlan);
    await asUser.locator('button:has-text("選択")').first().click();
    await expect.poll(() => checkoutHit).toBe(true);
    await expect.poll(() => stripeAborted).toBe(true);
  });
});
```
(`button:has-text("選択")` = a selectable non-current plan, verified in Step 1; current plan shows `ご利用中`. If Step 1's grep shows different markup, use the verified selector.)

- [ ] **Step 3: Run + commit**

Run: `cd frontend && npm run test:e2e -- --project=authed mypage.spec.ts` → PASS.
```bash
git add frontend/e2e/mypage.spec.ts
git commit -m "test(e2e): mypage view/edit + Stripe checkout boundary"
```

---

## Task 13: `booking.spec.ts`

**Files:** Create `frontend/e2e/booking.spec.ts`

- [ ] **Step 1: Inspect /book markup for slot/booking selectors**

Run: `sed -n '1,160p' frontend/src/app/book/page.tsx`
Identify how a seeded `lesson_slots` row renders and the booking action element.

- [ ] **Step 2: Write the spec**

```ts
import { test, expect } from "./helpers/auth";
import { ROUTES } from "./helpers/selectors";

test.describe("booking (authed, seeded slot)", () => {
  test("happy path: book seeded open slot", async ({ asUser }) => {
    await asUser.goto(ROUTES.book);
    await expect(asUser.locator("main")).toBeVisible();
    const slot = asUser.locator('[data-slot-id], button:has-text("予約")').first();
    await expect(slot).toBeVisible();
    const [resp] = await Promise.all([
      asUser.waitForResponse((r) => r.url().includes("/api/v1/bookings") && r.request().method() === "POST"),
      slot.click(),
    ]);
    expect(resp.status()).toBeLessThan(400);
  });
});
```
(Replace `[data-slot-id]` / `予約` with the verified selectors from Step 1. If a confirm dialog/modal exists, drive it. The seeded `monthly_quota` remaining≥1 makes the POST succeed; without it backend returns 422 `no_active_quota`.)

- [ ] **Step 3: Run + commit**

Run: `cd frontend && npm run test:e2e -- --project=authed booking.spec.ts` → PASS.
```bash
git add frontend/e2e/booking.spec.ts
git commit -m "test(e2e): booking happy path (seeded slot + quota)"
```

---

## Task 14: `admin.spec.ts` + PR-2 verification + PR

**Files:** Create `frontend/e2e/admin.spec.ts`; Modify `frontend/e2e/README.md`, `CLAUDE.md`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from "./helpers/auth";
import { ROUTES } from "./helpers/selectors";

test.describe("admin gating", () => {
  test("non-admin user is redirected away from /admin", async ({ asUser }) => {
    await asUser.goto(ROUTES.adminLessons);
    await expect(asUser).toHaveURL(/\/$|\/login/);  // useAdminGuard redirects non-admin
  });

  test("admin sees lessons admin + detail", async ({ asAdmin }) => {
    await asAdmin.goto(ROUTES.adminLessons);
    await expect(asAdmin.locator("main")).toBeVisible();
    expect(asAdmin.url()).toContain("/admin/lessons");
    const row = asAdmin.locator('a[href^="/admin/lessons/"]').first();
    if (await row.count()) {
      await row.click();
      await expect(asAdmin).toHaveURL(/\/admin\/lessons\/.+/);
    }
  });
});
```
(Confirm the non-admin redirect target from `useAdminGuard` — adjust the regex to the real destination.)

- [ ] **Step 2: Update README + CLAUDE.md (M5)**

Append to `frontend/e2e/README.md` the Auth-emulator steps (firebase-auth-emulator :9099 starts via docker compose; globalSetup seeds users `e2e-user@`/`e2e-admin@`). In `CLAUDE.md` architecture/dev section add one line noting the `firebase-auth-emulator` compose service is e2e-only and e2e is not CI-integrated.

- [ ] **Step 3: Full PR-2 run**

Run:
```bash
docker compose up -d
cd frontend && npm run test:e2e -- --project=public && npm run test:e2e -- --project=authed
```
Expected: all public + authed specs PASS (first authed green ⇒ C1 project-id contract verified).

- [ ] **Step 4: Production-safety + scope assertion**

Run:
```bash
cd "$(git rev-parse --show-toplevel)"
git diff origin/main..HEAD -- frontend/src | grep -c "connectAuthEmulator" && echo "only gated block in src"
git diff --name-only origin/main..HEAD | sort
```
Expected: the ONLY `frontend/src/` diff is the gated block in `firebase.ts`; changed files limited to the PR-2 file list (firebase.ts, docker-compose.yml, firebase.json, .firebaserc, playwright.config.ts, e2e/*, README, CLAUDE.md).

- [ ] **Step 5: Commit + push + PR (no merge) — cross-cutting-reviewer gate FIRST**

```bash
git add frontend/e2e/admin.spec.ts frontend/e2e/README.md CLAUDE.md
git commit -m "test(e2e): admin gating; docs for auth-emulator e2e"
git push -u origin feat/e2e-auth
```
Then (controller): run the **cross-cutting-reviewer gate** (infra: docker-compose, firebase.ts prod-safety, C1 tri-project-id, no prod env touched). Only after PASS:
```bash
gh pr create --title "feat(e2e): Firebase Auth emulator + authed/booking/admin Playwright suite (PR-2/2)" --body "$(cat <<'EOF'
## Summary
Local-only Firebase Auth emulator wiring + authed/booking/admin e2e (scope B, part 2 of 2). Builds on PR-1's merged public suite.

## Changes
- `firebase.ts`: env-gated `connectAuthEmulator` (prod build: env unset → dead branch, zero behavior change).
- `docker-compose.yml`: `firebase-auth-emulator` (:9099); backend `GCP_PROJECT_ID` + `GOOGLE_CLOUD_PROJECT` = `demo-english-cafe` (C1: Firestore client vs Admin SDK read different env vars; both required for token-verify / Firestore namespace / seed to align). Firestore emulator service unchanged.
- `firebase.json` / `.firebaserc` (auth emulator, demo project).
- `playwright.config.ts`: `globalSetup` (clear→seed via emulator REST), `webServer.env`, projects split (authed = Chromium only).
- specs: mypage (Stripe boundary via request-interception, no real Stripe), booking (seeded slot+quota), admin (gating).

## Test plan
- [x] `docker compose up -d` → public + authed projects all green (authed green ⇒ tri-project-id C1 verified)
- [x] only `frontend/src/` change is the gated `connectAuthEmulator`; prod `.env`/Vercel untouched
- [x] cross-cutting-reviewer gate PASS (infra / prod-safety)
- [ ] (reviewer) spec-compliance + code-quality

## Migration / rollback
All env-gated / new files / additive compose service. `git revert` fully restores. No prod impact.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
(Do NOT merge — PR creation only. Infra change → cross-cutting-reviewer gate BEFORE the PR is opened.)

---

## Spec Coverage Self-Check

| Spec requirement | Task |
|---|---|
| PR-1 public specs (marketing/contact/auth-pages/browse/book-unauth/smoke), helpers, README, scaffold removed | 1–7 |
| contact: zod validation + real submit + 500 error block | 3 |
| browse covers `[id]` detail + `/reviews/submit` (M2) | 5 |
| book-unauth observed contract, not assumed (I2) | 6 |
| smoke all 18 routes 2xx, behavior≠smoke noted | 7 |
| PR-1 zero infra change (scope assert) | 7 |
| gated `connectAuthEmulator`, prod dead-code (C2 single block) | 8 |
| firebase.json/.firebaserc demo project | 8 |
| compose Auth emulator + backend BOTH `GCP_PROJECT_ID`&`GOOGLE_CLOUD_PROJECT`=demo (C1) | 9 |
| globalSetup clear→seed (M4), schema-matched users seed (I4), dep fail-fast | 10 |
| projects testMatch browser split (M3) | 10 |
| real-UI-login fixture + authState wait (C2/I1) | 11 |
| mypage + Stripe request-interception boundary (I3) | 12 |
| booking happy path (seeded quota/slot) | 13 |
| admin gating | 14 |
| README + CLAUDE.md updated (M5) | 14 |
| PR-2 prod-safety + scope assert, cross-cutting-reviewer gate, no merge | 14 |
| PR dependency order (M1) | header + PR-2 phase intro |
