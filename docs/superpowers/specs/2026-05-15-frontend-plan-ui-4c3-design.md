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
- 認証ヘッダは既存 `booking.ts` の `authHeaders()` と同パターン (Firebase `currentUser.getIdToken()` → `Authorization: Bearer`)。billing.ts 内に同等の private helper を置く (booking.ts の `authHeaders` は module-private なので再利用不可 → DRY より境界明確を優先し複製)
- `createCheckout`: `POST ${API_BASE}/api/v1/billing/checkout` body `{plan}` → `resp.data.url`
- `createPortal`: `POST ${API_BASE}/api/v1/billing/portal` body `{}` → `resp.data.url`。axios が 409 を投げたら `error.response?.data?.detail?.code === 'no_subscription'` を判定して `NoSubscriptionError` を throw、それ以外は再 throw

### `MeResponse` 拡張 (`frontend/src/lib/booking.ts`)

既存 `MeResponse` に 4 フィールド追加 (backend `UserResponse` と parity):

```typescript
  stripe_subscription_id: string | null;
  subscription_status: 'active' | 'past_due' | 'canceled' | null;
  subscription_cancel_at_period_end: boolean;
  current_period_end: string | null;  // ISO 8601
```

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
  │   ├ subscription_status ∈ {active, past_due} OR cancel_at_period_end
  │   │     → <SubscriptionStatus> + Portal ボタン
  │   └ subscription_status ∈ {null, canceled}
  │         → <PlanCard> ×3 (未加入フロー)
  ├ URL ?status=success → notify.success + getMe 再取得
  └ ?status=cancel → notify.info「キャンセルしました」
PlanCard 選択 → createCheckout(plan) → window.location.href = url
Portal ボタン → createPortal() → window.location.href = url
  (NoSubscriptionError → notify.error「まだ加入していません」)
```

## Components

### `frontend/src/app/mypage/plan/page.tsx`
client component。`useAuth` で認証ガード (既存 mypage と同パターン)。flag チェック → `getMe()` → status 分岐レンダ。`useSearchParams` で `?status` を読みトースト (`useNotificationStore`)。`status=success` 時は `getMe()` 再取得して最新表示。

### `frontend/src/app/mypage/plan/_components/PlanCard.tsx`
Props: `{ plan, currentPlan, onSelect, busy }`. 表示: プラン名 / `¥{price}/月 (税抜)` / `{coma} コマ` / ボタン。`plan === currentPlan` の時はボタン disabled で「ご利用中」、それ以外は「選択」ボタン → `onSelect(plan)`。表示データは frontend 定数:

| plan | 表示名 | price | coma |
|---|---|---|---|
| light | ライト | 6,000 | 4 |
| standard | スタンダード | 10,000 | 8 |
| intensive | 集中 | 15,000 | 16 |

カード群の下に「価格は税抜です。決済時に消費税 10% が加算されます。」注記。

### `frontend/src/app/mypage/plan/_components/SubscriptionStatus.tsx`
Props: `{ profile: MeResponse, onPortal, busy }`. 表示分岐 (Q-F1=a):

- `subscription_status === 'past_due'`: 赤バナー (`bg-red-50 text-red-700 border-red-300`)「お支払いが確認できませんでした。下のボタンから支払い方法を更新してください。」+ 赤強調 Portal ボタン
- `subscription_status === 'active'` & `subscription_cancel_at_period_end`: 黄バナー (`bg-yellow-50 text-yellow-800`)「{current_period_end を JST 日付整形} に解約予定です。継続する場合は管理画面で取り消してください。」+ Portal ボタン
- `subscription_status === 'active'` & `!cancel_at_period_end`: 「ご利用中: {現プラン表示名}」+ 「次回更新: {current_period_end JST}」+ 「支払い・プラン変更・解約を管理」Portal ボタン
- 日付整形: `new Date(current_period_end).toLocaleDateString('ja-JP')` (null なら日付行を出さない)

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
- `SubscriptionStatus.test.tsx`: `active`→「ご利用中」+ 次回更新 / `cancel_at_period_end`→黄バナー文言 / `past_due`→赤バナー文言 + Portal ボタン / Portal ボタンクリックで `onPortal` 呼ぶ
- `plan/page.test.tsx`: flag off→「準備中」 / 未加入(status=null)→PlanCard×3 / 加入済(active)→SubscriptionStatus / `?status=success`→success トースト + getMe 2 回呼ばれる / `?status=cancel`→info トースト
- `ProfileCard.test.tsx` (既存拡張): flag on で「プラン管理」リンク存在 / flag off で非存在 (既存アサーションは不変)

## Files

### Create
- `frontend/src/lib/billing.ts`
- `frontend/src/lib/__tests__/billing.test.ts`
- `frontend/src/app/mypage/plan/page.tsx`
- `frontend/src/app/mypage/plan/_components/PlanCard.tsx`
- `frontend/src/app/mypage/plan/_components/SubscriptionStatus.tsx`
- `frontend/src/app/mypage/plan/_components/__tests__/PlanCard.test.tsx`
- `frontend/src/app/mypage/plan/_components/__tests__/SubscriptionStatus.test.tsx`
- `frontend/src/app/mypage/plan/__tests__/page.test.tsx`

### Modify
- `frontend/src/lib/booking.ts` (`MeResponse` +4 fields)
- `frontend/src/app/mypage/_components/ProfileCard.tsx` (プラン管理リンク, flag-gated)
- `frontend/src/app/mypage/_components/__tests__/ProfileCard.test.tsx` (link presence/absence)

## Out of Scope

- backend 変更 (4c-2 完了済)
- Stripe Dashboard 設定 (ops、親 spec 記載)
- 自前プラン変更/解約ロジック (Portal 集約)
- 年額/クーポン UI

## Migration / Rollback

- 全て新規追加 (1 既存型拡張 + 1 既存 component にリンク追加)
- `NEXT_PUBLIC_STRIPE_ENABLED` 未設定/`false` で UI 完全非表示 → feature flag rollback
- `MeResponse` フィールド追加は additive (backend は既に返している、frontend が読まなくても無害だったものを読むだけ)
