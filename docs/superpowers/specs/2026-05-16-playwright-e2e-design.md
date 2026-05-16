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
| Stripe | PR-2 で e2e 時のみ `NEXT_PUBLIC_STRIPE_ENABLED=true`。**境界はリクエスト傍受で判定**: `page.route('**/api/v1/billing/checkout', fulfill {url:"https://checkout.stripe.com/test"})` で stub を返す **かつ** `page.route('https://checkout.stripe.com/**', abort)` で off-site 遷移を握り潰す。assertion は「checkout リクエストが発火したこと」「checkout.stripe.com への遷移が abort されたこと」で行う（`window.location` ポーリングは遷移と競合するため不可） |
| **Project ID 統一 (C1)** | e2e スタックは単一 project id **`demo-english-cafe`** で統一。(1) frontend e2e env `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-english-cafe`、(2) Auth emulator `--project demo-english-cafe`、(3) backend は **`GOOGLE_CLOUD_PROJECT=demo-english-cafe`**（Admin SDK は `GCP_PROJECT_ID` を読まない。`verify_id_token` の aud/iss 検証 = この値）。Firestore emulator のサービス定義(`--project=english-cafe-dev`)は不変だが、emulator は client 指定 project でデータを分割するため backend の Firestore AsyncClient も `GOOGLE_CLOUD_PROJECT=demo-english-cafe` で読む → seed も同 project。三者一致しないと全認証 spec が 401 |
| **Auth fixture 方式 (C2)** | storageState 不採用に加え `page.evaluate` での app `firebaseAuth` 再利用も不採用（module-scope export で page realm から到達不可）。**実 UI ログイン**（`/login` フォーム入力→submit、アプリ自身の emulator 配線済インスタンスを行使）を fixture の機構とする |
| CI | e2e の CI 統合は本スコープ外（既存 CI #20 は backend のみ）。ローカル/手動実行前提。将来課題として README + CLAUDE.md に明記 |

## Architecture

### 共通: 実行前提・ヘルパ

- e2e 実行は `docker compose up -d`（frontend 3010 / backend 8010 / firestore-emulator 8080）が前提。`playwright.config.ts` の `webServer` は frontend のみ起動するため、**backend + emulator は docker-compose で別途起動**する旨を `frontend/e2e/README.md`（新規）に明記。
- `frontend/e2e/helpers/` に小さな page アクセサ群（セレクタの一元化）を置く。Page Object の重厚な抽象化はしない（YAGNI）。公開系で使うのは「ナビゲーション」「フォーム入力」「通知トースト待ち」程度。

### PR-1 — 公開フロー e2e（インフラ変更なし）

新規 spec（`frontend/e2e/*.spec.ts`）。docker-compose 起動だけで全 green になること:

- `marketing.spec.ts`: `/` レンダリング、主要セクション可視、ヘッダ/フッタのナビ遷移（`/lessons` `/instructors` `/reviews` `/videos` `/contact` へ）、404 でない。
- `contact.spec.ts`: `/contact` — (a) 必須未入力で送信ボタン disabled・各 field の `p.text-red-600` 検証メッセージ表示、(b) `lessonType` 空のままはエラー、(c) `message` 9文字でエラー/10文字で解消、(d) 正常入力 → 実 backend `POST /api/v1/contacts/` → 成功通知 `送信完了` 表示・フォーム reset、(e) backend を `page.route` で 500 にして送信エラー `h3:送信エラー` ブロック表示。
- `auth-pages.spec.ts`: `/login` `/signup` の描画・必須/形式バリデーション（クライアント側 zod/Firebase 呼び出し前の UI 検証のみ。実 Firebase 送信は行わない＝PR-2 へ）。`/signup` のパスワード要件メッセージ等。
- `browse.spec.ts`: `/lessons`・一覧から `/lessons/[id]` 詳細、`/instructors`・一覧から `/instructors/[id]` 詳細、`/reviews`、`/reviews/submit`（ReviewForm 描画+クライアント検証）、`/videos` の描画・主要要素可視・リンク健全性（**M2**: `[id]` 詳細と `/reviews/submit` を明示カバー）。
- `book-unauth.spec.ts`: `/book` 未認証アクセスの**実ガード契約を観測ベースで assert**（**I2**: admin ガードと同一とは仮定しない）。実装時に `frontend/src/app/book/page.tsx` のガード機構を確認し、実際の挙動（スロット閲覧可否／予約操作時の redirect 先 or 401 UI）を spec 化する。spec は assumed `/login` ではなく観測された契約を固定する。
- `smoke.spec.ts`: 全 18 ルート（sitemap.xml/robots.txt/health 含む“18”は 2xx のみで可、page は landmark 可視 + コンソール致命エラー無し。`/debug` は 2xx のみ）。authed ルートは未認証時の redirect 先が観測契約どおりか確認。**M2**: smoke の 2xx は behavior 網羅ではない旨を明記（深い behavior は個別 spec が担う）。

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

**(c) e2e 環境 env（project id 統一 — C1）**
e2e 用 env を `playwright.config.ts` の `webServer.env`（専用 `npm run dev:e2e` でも可）で与える:
- `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=localhost:9099`
- `NEXT_PUBLIC_STRIPE_ENABLED=true`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-english-cafe`（**C1**: トークンの aud/iss をこの project に固定。本番 `.env.local` の実 project を上書きするのは e2e プロセス env のみ）
- `NEXT_PUBLIC_FIREBASE_API_KEY` / `AUTH_DOMAIN` は emulator では任意値で可（`connectAuthEmulator` 接続時 API key 検証なし）が、`firebase.ts` の非 null assertion を満たすためダミー値を e2e env に設定。

backend(docker-compose) 側 env（**C1**）: `GOOGLE_CLOUD_PROJECT=demo-english-cafe` を追加（Admin SDK の `verify_id_token` project 解決 = これ。`GCP_PROJECT_ID` は Admin SDK 非対応のため不可）。Firestore AsyncClient も同 env を resolve するので Firestore emulator(8080, サービス定義不変)上のデータは `demo-english-cafe` namespace に入り、seed/read/トークン検証の三者が一致。本番 `.env`/Vercel env は一切不変。

**(d) Playwright `globalSetup`（seed — 順序・冪等・schema 整合）**
`frontend/e2e/global-setup.ts` を `playwright.config.ts` に登録。credential 不要な **エミュレータ REST**。すべて project=`demo-english-cafe`:
- **到達性 fail-fast**: 8010(backend)/8080(Firestore emu)/9099(Auth emu) を ping、未起動なら明示エラーで停止（誤って本番へ向かう事故防止）。
- **Auth クリア→作成（M4: signUp は非冪等）**: 先に `DELETE http://localhost:9099/emulator/v1/projects/demo-english-cafe/accounts`（全アカウント削除）→ `accounts:signUp`(`?key=any`) で固定ユーザ作成: 一般 `e2e-user@example.com` / admin `e2e-admin@example.com`（固定パスワード）。
- admin custom claim: Auth emulator の `POST /identitytoolkit.googleapis.com/v1/projects/demo-english-cafe/accounts:update`（emulator は `customAttributes` を credential 無しで受理）で admin uid に `{"admin":true}` を付与。
- **Firestore seed（I4: 順序 + schema 整合）**: 認証 spec が `GET users/me` を打つ前に必ず `users/{uid}` を作成する（doc 不在だと backend は 404 を返し client へ `POST users/me` を促す＝非決定的になる）。seed する `users/{uid}` は `FirestoreUserRepository` の永続スキーマに一致させる（最低 `uid`/`email`/`plan`/`trial_used`、実フィールドは plan 実装時に `backend/app/infrastructure/repositories/` の user mapping を spot-check して確定）。さらに `monthly_quota/{userUid}_{YYYY-MM}`(残 ≥1)、`lesson_slots/{slotId}`(`status:'open'`,`capacity:5`,`booked_count:0`,`start_at`=now+72h)。Firestore 書き込みは upsert 冪等。
- backend `POST users/me` 自動プロビジョニングには依存しない（決定論性のため Firestore 直 seed が基準）。

**(e) 認証 fixture（C2: 実 UI ログイン / I1: 認証確立同期）**
storageState（IndexedDB 非捕捉）も `page.evaluate` での app `firebaseAuth` 再利用（module-scope export で page realm 到達不可・別インスタンス生成リスク）も**不採用**。`frontend/e2e/helpers/auth.ts` に `test.extend` で `asUser` / `asAdmin` fixture:
- `page.goto('/login')` → seed 済 credential を入力 → submit（**アプリ自身の emulator 配線済 Firebase インスタンスを行使**＝最も忠実、window hack 不要で「firebase.ts は単一 gated ブロックのみ」の本番無影響主張を維持）。
- **I1**: submit 後、`authStore` の `loading===false` かつ `user!==null` が成立するまで待機（authed 専用 DOM 要素の可視 or store 露出値の poll）してから次操作へ。これを満たさず遷移すると `useAdminGuard` が `loading` 遷移中に誤 redirect する。fixture の明示ステップとする。
- 各 authed spec は毎テスト独立にこの fixture で認証確立（決定論的・並列安全）。

**(f) 認証 spec**
- `mypage.spec.ts`: `asUser` → `/mypage` 表示（プロフィール/予約/問い合わせ各セクション）、`/mypage/edit` で `PUT users/me` → 反映、`/mypage/plan`（`NEXT_PUBLIC_STRIPE_ENABLED=true`）でプラン選択 → **I3 の境界**: `page.route('**/api/v1/billing/checkout')` を stub で fulfill ＋ `page.route('https://checkout.stripe.com/**', abort)` を事前登録し、「checkout リクエストが発火・stub 応答した」「checkout.stripe.com への遷移が abort で観測された」を assert（`window.location` ポーリングはしない）。
- `booking.spec.ts`: `asUser` → `/book` でシード済 `lesson_slots` 表示 → セル選択 → `POST /api/v1/bookings` 成功 → 予約済反映 / quota 減。続けて quota 0 や満席スロットで適切なエラー UI（happy-path + 主要異常 1-2）。
- `admin.spec.ts`: `asUser` で `/admin/lessons` → `/` へ redirect（ガード）。`asAdmin` で `/admin/lessons` 一覧表示 + `/admin/lessons/[id]` 詳細、admin 専用操作の UI 到達（破壊的 backend 操作までは踏み込みすぎない範囲で happy-path）。

## Error handling / risk

| リスク | 対応 |
|---|---|
| **C1 project-id 不整合で全認証 spec 401** | frontend/Auth emu/backend を単一 `demo-english-cafe` に固定（Settled decisions「Project ID 統一」+ §PR-2 c）。backend は `GOOGLE_CLOUD_PROJECT`（`GCP_PROJECT_ID` 不可）。レビューで三者一致を gate |
| **C2 fixture が app firebaseAuth に到達不可** | 実 UI ログイン方式（§PR-2 e）。`page.evaluate` 再利用・window hack 不採用 → firebase.ts は単一 gated ブロックのみ |
| `firebase.ts` 変更が本番に影響 | `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST` は `NEXT_PUBLIC_*`＝Next.js が build 時 inline。Vercel build で未設定 → 当該分岐は dead code＝現行完全同一。Vercel env に追加しないことを PR 明記、cross-cutting-reviewer で本番無影響を gate |
| Auth emulator が gcloud SDK イメージに無い | firebase-tools イメージで Auth のみ起動する新 compose サービス（9099）。Firestore emulator(gcloud-cli 8080)は既存維持。CLAUDE.md architecture 注記に新サービスを追記（**M5**: README だけでなく authoritative dev doc にも） |
| IndexedDB セッションを storageState で持ち回せない | storageState 不採用を明言、実 UI ログイン fixture（§PR-2 e） |
| **I1 認証確立前遷移で誤 redirect** | fixture が `authStore.loading===false && user!==null` 成立まで待機（§PR-2 e）。`useAdminGuard` の loading 遷移中 redirect を回避 |
| **I2 `/book` 未認証契約を誤仮定** | 実装時に実ガードを観測し契約を固定（§PR-1 book-unauth）。admin ガードと同一と仮定しない |
| **I4 users/me 自動プロビジョニング競合** | globalSetup が `users/{uid}` を先に seed、永続スキーマと一致（§PR-2 d）。backend 自動プロビ非依存 |
| globalSetup が本番 Firebase/Firestore を叩く事故 | `demo-english-cafe` + エミュレータ REST(localhost:9099/8080)限定。実 credential/ADC 不使用。8010/8080/9099 到達性 fail-fast |
| webServer が backend/emulator を起動しない | `frontend/e2e/README.md` + CLAUDE.md に「先に `docker compose up -d`」を必須手順記載。globalSetup 冒頭で到達性チェック |
| **I3/Stripe 遷移 race** | request 傍受で判定（checkout fulfill + checkout.stripe.com abort、`window.location` 非ポーリング）。`NEXT_PUBLIC_STRIPE_ENABLED=true` は e2e env 限定、実 Stripe key 不使用 |
| **M4 Auth emulator signUp 非冪等** | globalSetup が先に `DELETE .../accounts`（全削除）してから signUp。Firestore は upsert 冪等 |
| flaky（Firebase 初期化競合） | fixture で `authStateReady()`/store 解決待ち。retries は既存 config(CI=2)踏襲、ローカル 0 |
| **M3 5 ブラウザ × 全 spec で遅い** | Playwright は native tag 無し → `projects` の `testMatch` で分離: 公開 smoke は全 5 ブラウザ、重い authed spec(mypage/booking/admin)は Chromium project のみ。plan で `testMatch` glob を確定 |

## Testing

- PR-1: `docker compose up -d` → `cd frontend && npm run test:e2e`（Chromium 最低限 green、CI 想定の `--workers=1` でも green）。インフラ差分ゼロを scope assert。
- PR-2: `docker compose up -d`（Auth emulator 9099 含む）→ globalSetup が clear→seed → 公開 + 認証 spec 全 green。
  - **C1 検証**: 認証 spec が実際に 2xx（`verify_id_token` 成功）であること自体が三者 project-id 一致の検証。最初の authed spec green = project-id 契約 OK。
  - `firebase.ts` 差分が gated であることを確認（env 未設定で `connectAuthEmulator` 未呼び出し＝現行同一）。
  - **I3 検証**: plan spec で checkout stub fulfill と checkout.stripe.com abort の双方が観測される（実 Stripe 到達ゼロ）。
- 各 PR とも独立レビュー（spec/plan は別エージェント、自己レビュー禁止）→ infra 含む PR-2 は **cross-cutting-reviewer gate 必須**（docker-compose / firebase.ts / project-id 三者一致 / 本番無影響）。
- 本番無影響の確認: PR-2 で `frontend/src/` 変更は `firebase.ts` の gated ブロックのみ・`shared/`/backend app コード不変であること。

## Files

### PR-1（公開 e2e — インフラ変更なし）
- 新規: `frontend/e2e/marketing.spec.ts`, `contact.spec.ts`, `auth-pages.spec.ts`, `browse.spec.ts`, `book-unauth.spec.ts`, `smoke.spec.ts`
- 新規: `frontend/e2e/helpers/` 最小アクセサ（nav/form/notification）
- 新規: `frontend/e2e/README.md`（実行前提: docker compose 必須、backend/emulator は別起動）
- 削除: `frontend/e2e/example.spec.ts`
- 変更なし: `playwright.config.ts`（globalSetup 等は PR-2 で追加）

### PR-2（Auth emulator 配線 + 認証 e2e）
- 変更: `frontend/src/lib/firebase.ts`（gated `connectAuthEmulator` のみ＝唯一の `frontend/src/` 変更）
- 変更: `docker-compose.yml`（firebase-auth-emulator サービス追加(9099)、backend env に `FIREBASE_AUTH_EMULATOR_HOST=firebase-auth-emulator:9099` **と** `GOOGLE_CLOUD_PROJECT=demo-english-cafe`（**C1**）。既存 Firestore emulator サービス定義は不変）
- 新規: `firebase.json`, `.firebaserc`（auth emulator 最小・project `demo-english-cafe`）
- 変更: `frontend/playwright.config.ts`（`globalSetup`、`webServer.env` に e2e フラグ群〔§PR-2 c〕、`projects` を `testMatch` で公開全ブラウザ/authed Chromium-only に分離〔**M3**〕）
- 新規: `frontend/e2e/global-setup.ts`, `frontend/e2e/helpers/auth.ts`
- 新規: `frontend/e2e/mypage.spec.ts`, `booking.spec.ts`, `admin.spec.ts`
- 変更: `frontend/e2e/README.md`（Auth emulator + docker compose 手順追記）、`CLAUDE.md`（**M5**: architecture 注記に firebase-auth-emulator サービス + e2e が CI 非統合・ローカル手順である旨を追記。authoritative dev doc のため README だけでは不足）

### PR 依存順 (M1)
PR-2 は **PR-1 マージ後の baseline** を前提（PR-1 が `example.spec.ts` 削除済・`frontend/e2e/` 雛形群がある状態に `globalSetup`/authed spec を足す）。PR-1 は `playwright.config.ts` を変更しない（infra ゼロ差分を厳守）。万一 PR-2 が先行マージされた場合は PR-1 を rebase（機能衝突はなし、設定差分のみ）。両 PR ともマージは user 手動・PR 作成まで。

### 明示的に不変
- `backend/app/`・`shared/`・terraform module/stack・本番 `.env`/Vercel env・本番 Firebase project
- 既存 Firestore emulator サービス定義（gcloud-cli 8080, `--project=english-cafe-dev` のまま — emulator は client 指定 project でデータ分割するため backend の `GOOGLE_CLOUD_PROJECT` 切替だけで整合）

## Out of scope

- e2e の GitHub Actions / CI 統合（将来課題、README 明記のみ）
- Stripe Checkout 以降〜webhook の本物 e2e（4c は backend テストで担保済）
- ビジュアルリグレッション / Lighthouse / 負荷
- 既存 `frontend/src/` の `any` 型整理（findings で観測されたが本タスク非対象）
- Firebase Auth エミュレータの本番/CI 常用化（ローカル開発・e2e 限定）

## Migration / rollback

- PR-1: テストコード追加のみ。runtime 無影響。`git revert` で完全復旧。
- PR-2: `firebase.ts` は env gated（本番 env 不設定で no-op）。docker-compose は新サービス追加（既存サービス不変）。`firebase.json`/`.firebaserc` は新規。`git revert` で完全復旧、本番影響なし。
