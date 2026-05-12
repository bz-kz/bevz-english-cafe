# frontend

Next.js 14 App Router + TypeScript + Tailwind + Zustand. マーケティングサイトのフロントエンド。詳細は `../CLAUDE.md` および `./CLAUDE.md` を参照。

## Bundle baseline

Run `npm run build:analyze` (= `ANALYZE=true next build`) to regenerate. Reports land in `.next/analyze/{client,nodejs,edge}.html` (gitignored).

### After Stage E5 (debug-page code-split) — 2026-05-12

`/debug` route is now a thin dev-only entry: in production it returns `notFound()` and the heavy `_DebugPanel` module is lazy-loaded only in development (via `next/dynamic` + `ssr: false`).

Top 3 client-bundle contributors (parsed size, from `.next/analyze/client.html`):

1. `next` (internal runtime/helpers, inside `lib-*.js`) — 499.4 kB parsed / ~131 kB gzip
2. `@testing-library` (still appearing in `lib-*.js`) — 172.0 kB parsed / 31.4 kB gzip
3. `react-dom` (inside `framework-*.js`) — ~134 kB parsed / ~42 kB gzip

Top 3 *application-level* dependencies (excluding next/react runtime):

1. `@testing-library` — 172.0 kB parsed / 31.4 kB gzip
2. `zod/v3` — 56.6 kB parsed / ~12 kB gzip
3. `axios/lib` — 35.1 kB parsed / ~13 kB gzip

First Load JS shared by all routes: 266 kB (chunks: `lib` 231 kB + framework + commons).

Per-route `/debug` First Load JS: 273 kB (the route chunk itself is 1.71 kB — the debug panel is excluded from production builds).

**Note (Stage E5)**: Stage D3 attributed the `@testing-library` bytes to the `/debug` route. After splitting `_DebugPanel` off into its own dynamic chunk and confirming the debug page chunk no longer contains testing-library code, the package still appears in the shared `lib-*.js` chunk at roughly the same size. The actual source of the leak therefore lies elsewhere in the build (still under investigation — likely Next.js / webpack picking up `__tests__/*.test.tsx` files under `src/`). Stage E5's code-split is a prerequisite that removes the `/debug` route as a suspect; isolating and excluding the remaining leak is a follow-up task.

### Previous (Stage D3 baseline)

1. `next` — 487.7 kB parsed / 130.6 kB gzip
2. `@testing-library` — 168.0 kB parsed / 30.7 kB gzip *(attribution to /debug now disproven; see above)*
3. `react-dom` — 133.9 kB parsed / 41.8 kB gzip
