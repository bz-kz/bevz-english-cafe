# Frontend Plan UI (Sub-project 4c-3) Design

## Goal

`/mypage/plan` ページを追加。未加入ユーザーは 3 プランから Stripe Checkout で加入、加入済ユーザーは契約状況を確認し Stripe Customer Portal でプラン変更/解約/支払い方法更新を行う。Frontend のみ (backend は 4c-2 で完了済、変更なし)。

## Context & dependencies

- 親 spec: [`2026-05-15-stripe-integration-design.md`](./2026-05-15-stripe-integration-design.md) の 4c-3 境界。Q1/Q7/Q10 等は確定済。
- **依存**: 4c-2 (PR #16, MERGED)。backend `/api/v1/billing/checkout`・`/portal`・`/users/me` (subscription フィールド含む) が稼働。
- 4c-2 は backend のみだったため、frontend `MeResponse` 型に subscription フィールドが未追加 → 4c-3 で追加する。

## Settled (4c-3 固有)

| # | 決定 |
|---|---|
| Q-F1 | 加入済の status 表示は **全状態明示** (a): `active`=「ご利用中」、`past_due`=**赤バナー**+Portal CTA、`cancel_at_period_end`=「{日付}解約予定」黄バナー、`canceled`/`null`=未加入扱い(プラン選択表示) |
| 親Q1 | 価格: Light ¥6,000 / Standard ¥10,000 / Intensive ¥15,000 (税抜、UI に「+消費税10%」注記) |
| 親Q7 | プラン変更/解約は Stripe Customer Portal 集約 (自前ロジック無し) |
| 親 | feature flag `NEXT_PUBLIC_STRIPE_ENABLED` で UI gate |

## Architecture

### `frontend/src/lib/billing.ts` (新規)

```typescript
export class NoSubscriptionError extends Error {}

export async function createCheckout(
  plan: 'light' | 'standard' | 'intensive'
): Promise<string>  // returns Stripe Checkout URL

export async function createPortal(): Promise<string>
// returns Stripe Portal URL; throws NoSubscriptionError on 409 {code:'no_subscription'}
```

- `API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010'` (既存 `booking.ts` と同一)
- 認証ヘッダは既存 `booking.ts` の `authHeaders()` と同パターン (Firebase `currentUser.getIdToken()` → `Authorization: Bearer`)。`booking.ts` の `authHeaders` は module-private (未 export) なので billing.ts 内に同等の private helper を複製する。理由は「DRY」ではなく **sibling `booking.ts` モジュールと同じローカル流儀に合わせる** (両モジュールとも `src/lib/api.ts` の axios instance は使わず raw `axios.*` + 自前ヘッダ)
- `createCheckout`: `POST ${API_BASE}/api/v1/billing/checkout` body `{plan}` → `resp.data.url`
- `createPortal`: `POST ${API_BASE}/api/v1/billing/portal` body `{}` → `resp.data.url`。axios が 409 を投げたら `error.response?.data?.detail?.code === 'no_subscription'` を判定して `NoSubscriptionError` を throw、それ以外は再 throw

### `MeResponse` 拡張 (`frontend/src/lib/booking.ts`)

既存 `MeResponse` に 4 フィールド追加 (backend `UserResponse` と parity):

```typescript
  stripe_subscription_id: string | null;
  subscription_status: string | null;  // Stripe 由来 (backend は str をそのまま転送)
  subscription_cancel_at_period_end: boolean;
  current_period_end: string | null;  // ISO 8601
```

> **(C1) `subscription_status` は narrow union にしない**: backend `UserResponse.subscription_status` は `str | None` (Literal でない) で Stripe の値をそのまま転送する。Stripe は `active`/`past_due`/`canceled` 以外に `incomplete`/`incomplete_expired`/`trialing`/`unpaid` も返しうる。型は `string | null` とし、`SubscriptionStatus` 側で網羅的に分類 (下記の分類表 + フォールバック)。

### Feature flag

`NEXT_PUBLIC_STRIPE_ENABLED !== 'true'` のとき:
- `/mypage/plan` ページ本体は「準備中です」表示
- `ProfileCard` の「プラン管理」リンクは非表示

### Data flow

```
/mypage/plan (client component)
  ├ 未ログイン → /login へ redirect (既存 mypage と同じ useAuth ガード)
  ├ flag off → 「準備中」表示で終了
  ├ getMe() → MeResponse
  │   ├ subscription_status が非 null かつ ∉ {canceled}
  │   │     → <SubscriptionStatus> (status を網羅分類、上記表) + Portal ボタン
  │   └ subscription_status ∈ {null, canceled}
  │         → <PlanCard> ×3 (未加入フロー)
  ├ URL ?status=success → notify.success + getMe 再取得
  └ ?status=cancel → notify.info「キャンセルしました」
PlanCard 選択 → createCheckout(plan) → window.location.href = url
Portal ボタン → createPortal() → window.location.href = url
  (NoSubscriptionError → notify.error「まだ加入していません」)
```

## Components

### `frontend/src/app/mypage/plan/page.tsx` (+ `_PlanPageClient.tsx`)
**(I1) Suspense 分割必須**: Next.js 14 では `useSearchParams()` を使う client component は `<Suspense>` 境界が無いと production build/prerender が失敗する。既存コードに `useSearchParams` 使用例は無い (mirror 元なし)。構成:

- `page.tsx` — `'use client'` を付けない default export。`<Suspense fallback={<読み込み中>}>` で `<PlanPageClient/>` をラップするだけ
- `frontend/src/app/mypage/plan/_components/PlanPageClient.tsx` — `'use client'`。`useAuth` で認証ガード (既存 mypage と同パターン: `useEffect → if(!loading && !user) router.push('/login')`)。flag チェック → `getMe()` → status 分岐レンダ。`useSearchParams` で `?status` を読みトースト (`useNotificationStore`)。`status=success` 時は `getMe()` 再取得して最新表示

### `frontend/src/app/mypage/plan/_components/PlanCard.tsx`
Props: `{ plan, currentPlan, onSelect, busy }`. 表示: プラン名 / `¥{price}/月 (税抜)` / `{coma} コマ` / ボタン。`plan === currentPlan` の時はボタン disabled で「ご利用中」、それ以外は「選択」ボタン → `onSelect(plan)`。表示データは frontend 定数:

| plan | 表示名 | price | coma |
|---|---|---|---|
| light | ライト | 6,000 | 4 |
| standard | スタンダード | 10,000 | 8 |
| intensive | 集中 | 15,000 | 16 |

カード群の下に「価格は税抜です。決済時に消費税 10% が加算されます。」注記。

### `frontend/src/app/mypage/plan/_components/SubscriptionStatus.tsx`
Props: `{ profile: MeResponse, onPortal, busy }`. **(C1) status を網羅分類** (上から評価、最初にマッチした分岐):

| 条件 | 表示 |
|---|---|
| `status ∈ {past_due, unpaid, incomplete, incomplete_expired}` | 赤バナー (`bg-red-50 text-red-700 border-red-300`)「お支払いが確認できませんでした。下のボタンから支払い方法を更新してください。」+ 赤強調 Portal ボタン |
| `status ∈ {active, trialing}` & `cancel_at_period_end` | 黄バナー (`bg-yellow-50 text-yellow-800`)「{解約予定日} に解約予定です。継続する場合は管理画面で取り消してください。」+ Portal ボタン |
| `status ∈ {active, trialing}` & `!cancel_at_period_end` | 「ご利用中: {現プラン表示名}」+ 「次回更新: {current_period_end JST}」(null なら行省略) + 「支払い・プラン変更・解約を管理」Portal ボタン |
| その他の非 null status (未知値) | 黄バナー「サブスクリプションの状態をご確認ください (状態: {status})」+ Portal ボタン (安全側フォールバック、無表示にしない) |

- `status ∈ {null, canceled}` はこの component を描画しない (呼び出し側 PlanPageClient が PlanCard×3 を出す)
- 日付整形: `current_period_end ? new Date(current_period_end).toLocaleDateString('ja-JP') : null`
- **(Q1) 黄バナー(解約予定)で `current_period_end` が null の場合**: 文面を「解約予定です。継続する場合は管理画面で取り消してください。」とし、日付句 (「{日付} に」) を出さない (Invalid Date 防止)

### 既存変更
- `frontend/src/lib/booking.ts`: `MeResponse` に 4 フィールド追加
- `frontend/src/app/mypage/_components/ProfileCard.tsx`: plan 表示行付近に `/mypage/plan` への「プラン管理」リンク追加 (`NEXT_PUBLIC_STRIPE_ENABLED === 'true'` の時のみ)。既存テストが壊れないよう既存要素は不変、リンク追加のみ
- `frontend/src/app/mypage/page.tsx`: 変更なし (別ページ追加。導線は ProfileCard 経由)

## Error Handling

| 状況 | UI 挙動 |
|---|---|
| flag off | 「準備中です」表示、API 呼ばない |
| 未ログイン | `/login` redirect (既存ガード) |
| `getMe()` 失敗 | notify.error + 「読み込みに失敗しました」 |
| `createCheckout` 失敗 | notify.error「チェックアウトを開始できませんでした」、ページ維持 |
| `createPortal` `NoSubscriptionError` | notify.error「まだ加入していません」 |
| `createPortal` その他失敗 | notify.error「管理画面を開けませんでした」 |
| `?status=success` | notify.success「ご登録ありがとうございます」+ getMe 再取得 |
| `?status=cancel` | notify.info「お手続きをキャンセルしました」 |

## Testing (jest + RTL, axios mock, `@/lib/firebase` mock)

既存 admin/mypage テストと同じく `jest.mock('@/lib/firebase', ...)` で Firebase を mock (pre-existing 3 Firebase-env 失敗は無関係、触らない)。

- `frontend/src/lib/__tests__/billing.test.ts`: `createCheckout` が `/billing/checkout` に `{plan}` で POST し url を返す / `createPortal` が url を返す / 409 `{detail:{code:'no_subscription'}}` → `NoSubscriptionError` / 他 axios エラーは再 throw
- `PlanCard.test.tsx`: 現プランは「ご利用中」disabled / 他プランは「選択」→ `onSelect(plan)` / 価格・コマ表示
- `SubscriptionStatus.test.tsx`: `active`→「ご利用中」+ 次回更新 / `active`+cancel→黄バナー文言 / `active`+cancel+`current_period_end=null`→日付句なし黄バナー (Q1) / `past_due`→赤バナー + Portal / `unpaid`(未知扱い問題系)→赤バナー / `incomplete`→赤バナー / 未知値 `foo`→黄フォールバックバナー「状態をご確認ください」(C1) / Portal ボタンクリックで `onPortal` 呼ぶ
- `plan/page.test.tsx` (PlanPageClient を対象、Suspense wrapper 経由でも可): flag off→「準備中」 / 未加入(status=null)→PlanCard×3 / 加入済(active)→SubscriptionStatus / `?status=success`→success トースト + getMe 2 回呼ばれる / `?status=cancel`→info トースト
- `ProfileCard.test.tsx` (既存拡張): flag on で「プラン管理」リンク存在 / flag off で非存在 (既存アサーションは不変)

## Files

### Create
- `frontend/src/lib/billing.ts`
- `frontend/src/lib/__tests__/billing.test.ts`
- `frontend/src/app/mypage/plan/page.tsx` (Suspense wrapper, server)
- `frontend/src/app/mypage/plan/_components/PlanPageClient.tsx` (`'use client'`, useSearchParams)
- `frontend/src/app/mypage/plan/_components/PlanCard.tsx`
- `frontend/src/app/mypage/plan/_components/SubscriptionStatus.tsx`
- `frontend/src/app/mypage/plan/_components/__tests__/PlanCard.test.tsx`
- `frontend/src/app/mypage/plan/_components/__tests__/SubscriptionStatus.test.tsx`
- `frontend/src/app/mypage/plan/__tests__/page.test.tsx` (tests PlanPageClient)

### Modify
- `frontend/src/lib/booking.ts` (`MeResponse` +4 fields)
- `frontend/src/app/mypage/_components/ProfileCard.tsx` (プラン管理リンク, flag-gated)
- `frontend/src/app/mypage/_components/__tests__/ProfileCard.test.tsx` — link presence/absence。**(M3)** `MeResponse` に 4 フィールド追加で TS 必須化されるため、このテストの `profile()` ファクトリにも 4 フィールドを足す必要がある (既存 3 アサーションは不変)
- `frontend/.env.example` — **(I2)** `NEXT_PUBLIC_STRIPE_ENABLED=false` を追記 (現状 Stripe エントリ皆無)

### Ops (コード外、本番投入時)
- **(I2)** Vercel 本番で feature を有効化するには HCP workspace `english-cafe-prod-vercel` の `env_vars` HCL 変数に `NEXT_PUBLIC_STRIPE_ENABLED = "true"` を追加する (terraform/Vercel 管理。未登録だと prod は永久 off)。これは 4c-2 の Stripe Dashboard/secret 投入と同じ ops チェックリストに含める

## Out of Scope

- backend 変更 (4c-2 完了済)
- Stripe Dashboard 設定 (ops、親 spec 記載)
- 自前プラン変更/解約ロジック (Portal 集約)
- 年額/クーポン UI

## Migration / Rollback

- 全て新規追加 (1 既存型拡張 + 1 既存 component にリンク追加)
- `NEXT_PUBLIC_STRIPE_ENABLED` 未設定/`false` で UI 完全非表示 → feature flag rollback
- `MeResponse` フィールド追加は additive (backend は既に返している、frontend が読まなくても無害だったものを読むだけ)
