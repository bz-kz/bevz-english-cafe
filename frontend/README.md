# frontend

Next.js 14 App Router + TypeScript + Tailwind + Zustand. マーケティングサイトのフロントエンド。詳細は `../CLAUDE.md` および `./CLAUDE.md` を参照。

## Bundle baseline (Stage D3)

Run `npm run build:analyze` (= `ANALYZE=true next build`) to regenerate. Reports land in `.next/analyze/{client,nodejs,edge}.html` (gitignored).

Top 3 client-bundle contributors as of 2026-05-12 (parsed size, from `.next/analyze/client.html`):

1. `next` (internal runtime/helpers, inside `lib-*.js`) — 487.7 kB parsed / 130.6 kB gzip
2. `@testing-library` (leaking into prod via `/debug` page) — 168.0 kB parsed / 30.7 kB gzip
3. `react-dom` (inside `framework-*.js`) — 133.9 kB parsed / 41.8 kB gzip

Top 3 *application-level* dependencies (excluding next/react runtime):

1. `@testing-library` — 168.0 kB parsed / 30.7 kB gzip
2. `zod/v3` — 55.2 kB parsed / 12.5 kB gzip
3. `axios/lib` — 34.2 kB parsed / 13.4 kB gzip

First Load JS shared by all routes: 266 kB (chunks: `lib` 231 kB + framework + commons).

No optimization performed in Stage D — this is a baseline measurement only.
