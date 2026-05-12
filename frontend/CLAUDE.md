# frontend/CLAUDE.md

Next.js 14 App Router + TypeScript + Tailwind + Zustand. See `../CLAUDE.md` for the monorepo overview.

## 構成

- `src/app/` — App Router routes
- `src/components/sections/` — マーケティングのセクション（`app/page.tsx` で合成）
- `src/components/forms/` — `ContactForm`, `ReviewForm`
- `src/components/ui/` — `Button`, `Card`, `Input`, etc. の再利用プリミティブ
- `src/lib/api.ts` — 単一の axios インスタンス。interceptor で auth token / エラーメッセージを管理。**`NEXT_PUBLIC_API_URL` を使う**（後述）
- `src/stores/` — Zustand stores (`notificationStore` を主に使う)
- `src/data/` — マーケティング固定データ（teachers, lessons など）
- `src/schemas/` — zod バリデーションスキーマ（contact など）

## 環境変数の罠

`NEXT_PUBLIC_API_URL` が正規名。`next.config.js` rewrite, jest.env.setup, debug ページ等は全部この名前。

## バリデーション

`src/schemas/contact.ts` (zod) が単一の真実。`ContactForm.tsx` は `safeParse` で per-field エラーを得る。バックエンドの `app/api/schemas/contact.py`（Pydantic）と数値・enum の手書きパリティが必要 — どちらか変えたらもう一方も。

## テスト

- jest threshold 70%。大型 section（>400 行）はスモークレベルでも追加すべし。
- Playwright e2e は `npm run test:e2e`。
