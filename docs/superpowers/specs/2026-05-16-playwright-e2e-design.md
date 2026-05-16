# Comprehensive Playwright E2E (Public + Auth-Emulator) Design

## Goal

`frontend/` の UI を Playwright で網羅的に e2e テストする。現状 `frontend/e2e/example.spec.ts`（雛形）のみで実カバレッジゼロ。アプリは 18 ルート、認証は Firebase Auth クライアント SDK だが **Auth エミュレータ未配線**のためローカル/CI で認証フローを回せない。本タスクで (1) 公開フロー e2e を即追加、(2) Firebase Auth エミュレータをローカル専用に配線して認証/予約/admin フローも e2e 化する。

## Context (調査確定 — 2026-05-16 findings packet)

- `frontend/playwright.config.ts`: `testDir=./e2e`, `baseURL=http://localhost:3010`, `webServer.command="npm run dev"`（**frontend のみ**起動。backend / Firestore emulator は別途必要）, `reuseExistingServer` local=true/CI=false, projects = Chromium/Firefox/WebKit/Mobile Chrome/Mobile Safari, `globalSetup` 無し, `storageState` 未使用。
- 認証 = Firebase Auth client SDK (`firebase@^12`)。`LoginForm` → `signInWithEmailAndPassword`、`SignupForm` → `createUserWithEmailAndPassword` 後 `POST /api/v1/users/me`。`authStore` が `onAuthStateChanged` + `getIdTokenResult().claims.admin` で `isAdmin` 判定。protected API は `Authorization: Bearer <idToken>`。backend `auth.py` が `verify_id_token` + `decoded["admin"]`。
- **Firebase Auth エミュレータはリポジトリのどこにも配線されていない**（`firebase.ts` に `connectAuthEmulator` 無し、`docker-compose.yml` は Firestore emulator(8080) のみ、`FIREBASE_AUTH_EMULATOR_HOST` 未設定）。Firebase web 設定 (`NEXT_PUBLIC_FIREBASE_*`) は `.env.example` に無く `.env.local`（本番 Firebase プロジェクト）想定。
- セッション永続化 = Firebase 既定の **IndexedDB**（`browserLocalPersistence`）。Playwright の `storageState` は cookie + localStorage のみ捕捉し IndexedDB は**捕捉しない** → storageState によるセッション使い回し不可。
- Stripe: `NEXT_PUBLIC_STRIPE_ENABLED` 既定 `false` → `/mypage/plan` は「準備中です」表示で API 呼ばない。`true` 時 `POST /api/v1/billing/checkout` → `{url}` → `window.location.href=url`（off-site）。stub する env フラグは無く、テスト側ネットワーク層で intercept する。
- 認証ページが読む backend / Firestore: `/mypage`=`GET users/me`,`users/me/contacts`,`users/me/bookings`（`users`/`contacts`/`bookings`/`lesson_slots`）, `/mypage/edit`=`GET,PUT users/me`（`users`）, `/mypage/plan`=`GET users/me`,`POST billing/checkout|portal`, `/book`=`GET lesson-slots`,`GET users/me/bookings`,`POST bookings`（`lesson_slots`/`bookings`/`monthly_quota`）, `/admin/lessons`=`GET lesson-slots`(public)。予約 happy-path 最小 seed: `users/{uid}`(`plan:'standard'`,`trial_used:false`) + `monthly_quota/{uid}_{YYYY-MM}`(残 ≥1) + `lesson_slots/{id}`(`status:'open'`,`capacity:5`,`booked_count:0`,`start_at` ≥ 48h 先)。quota doc 無いと予約は 422 `no_active_quota`。
- admin 判定 = Firebase custom claim `admin:true` のみ（frontend `useAdminGuard` は client-side redirect、backend は 403）。
- ContactForm: `name`(1-100)/`email`(1-255)/`phone`(任意 regex)/`lessonType`(select 7値, 空=エラー)/`preferredContact`(radio 5値 既定 email)/`message`(10-1000)。全 field に `id`。送信 `POST /api/v1/contacts/`。検証エラー = 各 field 隣の `p.text-red-600`、送信ボタンは `!isFormValid` で disabled。送信エラー = `h3:送信エラー` ブロック。成功 = 通知ストア `title:'送信完了'`（フォーム reset + `onSuccess`）。
- MSW 不使用。Playwright fixture は既定 `{page}` のみ。

## Settled decisions

| # | 決定 |
|---|---|
| Scope | **B**: 公開フロー網羅 + 認証(mypage/予約/admin) happy-path。Stripe 決済は stub/skip(redirect 直前を境界) |
| Auth approach | **1**: Firebase Auth エミュレータをローカル専用に配線（`firebase.ts` を env フラグ gated に。フラグ未設定＝本番と完全同一挙動・無影響）。本番 Firebase / storageState 案は不採用 |
| Delivery | **2 PR 分割**（各マージなし・PR 作成まで）。PR-1 公開、PR-2 認証基盤+認証 e2e |
| Stripe | PR-2 で e2e 時のみ `NEXT_PUBLIC_STRIPE_ENABLED=true`。`page.route('**/api/v1/billing/checkout')` で stub `{url:"https://checkout.stripe.com/test"}` を返し、`window.location` がその URL へ向く直前を assertion 境界とする |
| CI | e2e の CI 統合は本スコープ外（既存 CI #20 は backend のみ）。ローカル/手動実行前提。将来課題として README に明記 |

## Architecture

### 共通: 実行前提・ヘルパ

- e2e 実行は `docker compose up -d`（frontend 3010 / backend 8010 / firestore-emulator 8080）が前提。`playwright.config.ts` の `webServer` は frontend のみ起動するため、**backend + emulator は docker-compose で別途起動**する旨を `frontend/e2e/README.md`（新規）に明記。
- `frontend/e2e/helpers/` に小さな page アクセサ群（セレクタの一元化）を置く。Page Object の重厚な抽象化はしない（YAGNI）。公開系で使うのは「ナビゲーション」「フォーム入力」「通知トースト待ち」程度。

### PR-1 — 公開フロー e2e（インフラ変更なし）

新規 spec（`frontend/e2e/*.spec.ts`）。docker-compose 起動だけで全 green になること:

- `marketing.spec.ts`: `/` レンダリング、主要セクション可視、ヘッダ/フッタのナビ遷移（`/lessons` `/instructors` `/reviews` `/videos` `/contact` へ）、404 でない。
- `contact.spec.ts`: `/contact` — (a) 必須未入力で送信ボタン disabled・各 field の `p.text-red-600` 検証メッセージ表示、(b) `lessonType` 空のままはエラー、(c) `message` 9文字でエラー/10文字で解消、(d) 正常入力 → 実 backend `POST /api/v1/contacts/` → 成功通知 `送信完了` 表示・フォーム reset、(e) backend を `page.route` で 500 にして送信エラー `h3:送信エラー` ブロック表示。
- `auth-pages.spec.ts`: `/login` `/signup` の描画・必須/形式バリデーション（クライアント側 zod/Firebase 呼び出し前の UI 検証のみ。実 Firebase 送信は行わない＝PR-2 へ）。`/signup` のパスワード要件メッセージ等。
- `browse.spec.ts`: `/lessons` `/instructors`(+ 一覧から `/instructors/[id]`) `/reviews` `/videos` の静的/データ無し描画、主要要素可視、リンク健全性。
- `book-unauth.spec.ts`: `/book` 未認証アクセス → スロット一覧は閲覧可、予約セル click → `/login` へ redirect されること（認証ガード挙動）。
- `smoke.spec.ts`: 全 18 ルートを順に開き 2xx / 主要 landmark 可視 / コンソール致命エラー無し（`/debug` 含む。authed ルートは未認証で redirect 先が想定どおりかを確認）。

`example.spec.ts` は削除（雛形不要）。

### PR-2 — Auth エミュレータ配線 + 認証/予約/admin e2e

**(a) `frontend/src/lib/firebase.ts`（アプリコード・最小・gated）**
初期化直後に、env が設定されている時のみエミュレータ接続を追加:
```ts
if (process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST) {
  connectAuthEmulator(firebaseAuth, `http://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
}
```
本番 Vercel ではこの env を設定しない → `connectAuthEmulator` 不実行＝**現行と完全同一挙動**。これが本 PR で唯一の `frontend/src/` 変更。

**(b) Firebase Auth エミュレータ（docker-compose + firebase.json）**
- Auth エミュレータは gcloud SDK イメージに無く firebase-tools 提供。`docker-compose.yml` に新サービス（firebase-tools イメージ、`firebase emulators:start --only auth --project <demo-id>`、ポート 9099、UI 不要）。Firestore emulator は既存（gcloud-cli イメージ・8080）を**維持**し触らない（変更最小化）。
- リポジトリ root に `firebase.json`（auth エミュレータのみ最小設定）+ `.firebaserc`（demo project id、例 `demo-english-cafe`）を新規。**demo- プレフィクス**の project id を使い、エミュレータが credential 不要で動くようにする。
- backend サービスの env に `FIREBASE_AUTH_EMULATOR_HOST=firebase-auth-emulator:9099`（Admin SDK 自動検出）。Firestore emulator host 既存設定はそのまま。

**(c) e2e 環境 env**
e2e 用 env（`frontend/e2e/.env.e2e` もしくは playwright 起動時 env）で `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=localhost:9099` と `NEXT_PUBLIC_STRIPE_ENABLED=true` を与える。webServer 起動コマンドにこれらを渡す（playwright.config の webServer.env、または専用 `npm run dev:e2e`）。本番 `.env`/Vercel は不変。

**(d) Playwright `globalSetup`（seed）**
`frontend/e2e/global-setup.ts` を `playwright.config.ts` に登録。credential 不要な **エミュレータ REST** で冪等 seed:
- Auth エミュレータ REST (`http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp` 等、`?key=any`) で固定テストユーザを作成: 一般ユーザ `e2e-user@example.com` / admin `e2e-admin@example.com`（パスワード固定）。
- admin ユーザに custom claim `admin:true` を付与（Auth エミュレータの `/emulator/v1/projects/<id>/accounts/<uid>:update` または Admin SDK 経由のセットアップスクリプト）。
- Firestore エミュレータ REST で seed: `users/{userUid}`(`plan:'standard'`,`trial_used:false`), `users/{adminUid}`, `monthly_quota/{userUid}_{YYYY-MM}`(残 ≥1), `lesson_slots/{slotId}`(`status:'open'`,`capacity:5`,`booked_count:0`,`start_at` = now+72h)。冪等（存在しても上書き）。
- globalSetup は backend が `users/me` 自動プロビジョニングする経路（`POST /api/v1/users/me`）を使ってもよいが、決定論性のため Firestore 直 seed を基本とする。

**(e) 認証 fixture**
storageState は Firebase の IndexedDB 永続化を捕捉できないため不採用。代わりに `frontend/e2e/helpers/auth.ts` に **プログラム的サインイン fixture**（`test.extend`）:
- テスト開始時に `page.goto('/')` 後 `page.evaluate` で Auth エミュレータに対し `signInWithEmailAndPassword` を実行（アプリの firebase 初期化を再利用）、`onAuthStateChanged` 解決を待つ。`asUser` / `asAdmin` の 2 fixture。
- 各 authed spec はこの fixture を使い、毎テスト独立に認証状態を確立（高速・決定論的・並列安全）。

**(f) 認証 spec**
- `mypage.spec.ts`: `asUser` → `/mypage` 表示（プロフィール/予約/問い合わせ各セクション）、`/mypage/edit` で `PUT users/me` → 反映、`/mypage/plan` は `NEXT_PUBLIC_STRIPE_ENABLED=true` 下でプラン選択 → `page.route` stub の `POST /api/v1/billing/checkout` 発火と `window.location` が `https://checkout.stripe.com/...` へ向くこと（実遷移は route abort で止め assertion）。
- `booking.spec.ts`: `asUser` → `/book` でシード済 `lesson_slots` 表示 → セル選択 → `POST /api/v1/bookings` 成功 → 予約済反映 / quota 減。続けて quota 0 や満席スロットで適切なエラー UI（happy-path + 主要異常 1-2）。
- `admin.spec.ts`: `asUser` で `/admin/lessons` → `/` へ redirect（ガード）。`asAdmin` で `/admin/lessons` 一覧表示 + `/admin/lessons/[id]` 詳細、admin 専用操作の UI 到達（破壊的 backend 操作までは踏み込みすぎない範囲で happy-path）。

## Error handling / risk

| リスク | 対応 |
|---|---|
| `firebase.ts` 変更が本番に影響 | env `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST` 未設定なら `connectAuthEmulator` 不実行＝現行同一。Vercel env に追加しないことを spec/PR に明記。レビューで本番無影響を gate |
| Auth emulator が gcloud SDK イメージに無い | firebase-tools イメージで Auth のみ起動する新 compose サービス。Firestore emulator は既存維持（混在運用を README 明記）。CLAUDE.md の「Firestore emulator = gcloud-cli」記述は誤りでないため変更不要、Auth は別コンテナと追記 |
| IndexedDB セッションを storageState で持ち回せない | 設計で storageState 不採用を明言、プログラム的サインイン fixture を採用 |
| globalSetup が本番 Firebase/Firestore を叩く事故 | demo- project id + エミュレータ REST(host=localhost:9099 / 8080) のみ使用。実 credential 不要、ADC 不使用。host 未起動時は globalSetup を fail-fast（誤接続より停止） |
| webServer が backend/emulator を起動しない | `frontend/e2e/README.md` に「先に `docker compose up -d`」を必須手順として記載。globalSetup 冒頭で 8010/8080/9099 到達性チェックし未起動なら明示エラー |
| Stripe 本物呼び出し事故 | `NEXT_PUBLIC_STRIPE_ENABLED=true` は e2e env 限定。spec で必ず `page.route` intercept してから操作。実 Stripe key は使わない（境界は redirect 直前） |
| flaky（Firebase 初期化/onAuthStateChanged 競合） | fixture で `authStateReady()` 解決待ち。retries は既存 config(CI=2) を踏襲、ローカルは 0 |
| 5 ブラウザ × 全 spec で遅い | 既定 projects は維持しつつ、重い authed spec は Chromium のみに絞る project tag/grep を plan で定義（公開 smoke は全ブラウザ） |

## Testing

- PR-1: `docker compose up -d` → `cd frontend && npm run test:e2e`（Chromium 最低限 green、CI 想定の `--workers=1` でも green）。インフラ差分ゼロを scope assert。
- PR-2: `docker compose up -d`（Auth emulator 含む）→ globalSetup が seed → 公開 + 認証 spec 全 green。`firebase.ts` 差分が gated（env 無しで no-op）であることをユニット観点で確認（env 未設定時 `connectAuthEmulator` 未呼び出し）。
- 各 PR とも独立レビュー（spec/plan は別エージェント）→ infra 含む PR-2 は **cross-cutting-reviewer gate 必須**（docker-compose / firebase.ts / 本番無影響）。
- 本番無影響の確認: PR-2 で `frontend/src/` 変更は `firebase.ts` の gated ブロックのみ・`shared/`/backend app コード不変であること。

## Files

### PR-1（公開 e2e — インフラ変更なし）
- 新規: `frontend/e2e/marketing.spec.ts`, `contact.spec.ts`, `auth-pages.spec.ts`, `browse.spec.ts`, `book-unauth.spec.ts`, `smoke.spec.ts`
- 新規: `frontend/e2e/helpers/` 最小アクセサ（nav/form/notification）
- 新規: `frontend/e2e/README.md`（実行前提: docker compose 必須、backend/emulator は別起動）
- 削除: `frontend/e2e/example.spec.ts`
- 変更なし: `playwright.config.ts`（globalSetup 等は PR-2 で追加）

### PR-2（Auth emulator 配線 + 認証 e2e）
- 変更: `frontend/src/lib/firebase.ts`（gated `connectAuthEmulator` のみ）
- 変更: `docker-compose.yml`（firebase-auth-emulator サービス追加、backend env に `FIREBASE_AUTH_EMULATOR_HOST`）
- 新規: `firebase.json`, `.firebaserc`（auth emulator 最小・demo project）
- 変更: `frontend/playwright.config.ts`（`globalSetup`、webServer.env に e2e フラグ、authed project 定義）
- 新規: `frontend/e2e/global-setup.ts`, `frontend/e2e/helpers/auth.ts`
- 新規: `frontend/e2e/mypage.spec.ts`, `booking.spec.ts`, `admin.spec.ts`
- 変更: `frontend/e2e/README.md`（Auth emulator 手順追記）, `terraform/README.md` or root `README.md` に「e2e は CI 非統合・ローカル手順」追記（最小）

### 明示的に不変
- `backend/app/`・`shared/`・terraform module/stack・本番 `.env`/Vercel env
- 既存 Firestore emulator サービス定義（gcloud-cli 8080）

## Out of scope

- e2e の GitHub Actions / CI 統合（将来課題、README 明記のみ）
- Stripe Checkout 以降〜webhook の本物 e2e（4c は backend テストで担保済）
- ビジュアルリグレッション / Lighthouse / 負荷
- 既存 `frontend/src/` の `any` 型整理（findings で観測されたが本タスク非対象）
- Firebase Auth エミュレータの本番/CI 常用化（ローカル開発・e2e 限定）

## Migration / rollback

- PR-1: テストコード追加のみ。runtime 無影響。`git revert` で完全復旧。
- PR-2: `firebase.ts` は env gated（本番 env 不設定で no-op）。docker-compose は新サービス追加（既存サービス不変）。`firebase.json`/`.firebaserc` は新規。`git revert` で完全復旧、本番影響なし。
