# バグ修正: Admin UI + ヘッダードロップダウン Design

## Goal

Sub-project 2a 完了後に顕在化した 3 件の UI バグを最小スコープで修正する。
機能 4 (新予約UI) とは独立した PR として先に push する。

## Scope

| # | バグ | 影響範囲 |
|---|------|----------|
| 1 | `/admin/lessons/[id]` の「枠を閉じる」ボタンが反応していないように見える | admin only |
| 2 | ヘッダー右上のユーザードロップダウンが一度開くと閉じない (outside click / Link 遷移で閉じない) | 全ユーザー |
| 3 | `/admin/lessons` の「新規枠を作成」ボタンが効くときと効かないときがある | admin only |

スコープ外: 機能追加、デザイン刷新、機能 4 (新予約UI)。

---

## Bug 1: 「枠を閉じる」ボタン

### 根本原因

`frontend/src/app/admin/lessons/[id]/page.tsx:66-69` の `handleClose` は
`adminUpdateSlot(id, { status: 'closed' })` を実行し、続いて `load()` で再取得している。
バックエンドの PUT は成功しており、`status` フィールドは `closed` に切り替わっている。

しかし UI 側で起きていることは:

1. クリック直後の楽観 UI なし (押した感がない)
2. `<dd>{slot.status}</dd>` の表示は `closed` に変わるが、ボタンは同じ位置に残ったまま
3. 成功トーストなし
4. 結果として「押しても何も起きない」と感じる

副次的問題: 一覧画面 `/admin/lessons` は `listOpenSlots` (= status=open のみ) を呼ぶため、
閉じた枠は一覧から消える。詳細ページに残ったまま編集すると違和感がある。

### 修正方針

1. 「枠を閉じる」クリック → 確認ダイアログ → `adminUpdateSlot` → 成功時に
   `/admin/lessons` へ `router.push` で戻る
2. ボタンに `busy` 状態と「閉じています…」ラベル
3. status が `open` 以外の場合「枠を閉じる」ボタンを非表示 (= 再閉鎖の二重押しを防ぐ)

### 変更対象ファイル

- `frontend/src/app/admin/lessons/[id]/page.tsx`
  - `handleClose` を非同期で `busy` ステート管理 + `router.push('/admin/lessons')`
  - ボタンは `slot.status === 'open'` のときのみ表示
  - `handleSave` と `handleDelete` も同じく busy 状態を持たせる (副次改善)

---

## Bug 2: ヘッダーのドロップダウン

### 根本原因

`frontend/src/components/layout/Header.tsx:54-81` で HTML5 の `<details><summary>` 要素を
ドロップダウンとして使っている。`<details>` の `open` 属性は:

- `<summary>` をもう一度クリックしないと閉じない
- 外部クリックで閉じない
- 内部の `<Link>` をクリックしてページ遷移しても閉じない (DOM 上で次ページに同じ
  ヘッダーがレンダーされ、初期状態は閉じている — が、SPA 遷移なので同じ React コンポーネント
  ツリーが残り、`open` が `true` のままになる)

### 修正方針

`<details>` を `useState` + `<button>` 制御の typical dropdown に置換。

- `useState<boolean>(false)` で `isOpen`
- `<button onClick={() => setIsOpen(v => !v)}>` がトリガー
- 外部クリック検出: `useEffect` 内で `document.addEventListener('mousedown', ...)`、
  ref が contain しない要素クリックで `setIsOpen(false)`
- `<Link onClick={() => setIsOpen(false)}>` でリンククリック時にも閉じる
- `onSignOut` 後にも閉じる

### 変更対象ファイル

- `frontend/src/components/layout/Header.tsx`
  - `useState`, `useRef`, `useEffect` で controlled dropdown 化
  - 既存の `<details>/<summary>` ツリーを `<div ref={...}>` + `<button>` + 条件付き `<div>` に置換
  - キーボード対応 (Esc キーで閉じる) は副次改善でついでに入れる

### 既存テストへの影響

`frontend/__tests__/` に Header のテストがあれば更新。なければそのまま (Sub-project 1 で
追加した可能性)。

---

## Bug 3: 「新規枠を作成」ボタン

### 根本原因の仮説

`frontend/src/app/admin/lessons/_components/SlotForm.tsx:30-57` の `submit` ハンドラを
精読した結果、複数の silent failure 経路が共存している:

1. **`onCreated()` 例外がフォームリセットを巻き戻す**
   - `await adminCreateSlot(input)` が成功した直後、フォーム state を空文字 / デフォルト値に
     リセットしてから `onCreated()` を呼ぶ。`onCreated` (= 親の `refresh` = `listOpenSlots`)
     が一時的にネットワーク失敗した場合、catch に落ちて「作成に失敗しました」と表示される
     — しかし実際は作成成功済み。ユーザーは「ボタンが効かなかった」と認識する
2. **トークンの読み取りタイミング race**
   - `adminCreateSlot` → `authHeaders` → `firebaseAuth.currentUser?.getIdToken()` の経路で、
     `currentUser` が null だと Authorization ヘッダーが消える。AdminLayout が
     `useAdminGuard` で `loading || !isAdmin` 中は children を render しないため正常時は
     起きないはずだが、Firebase Auth の `onAuthStateChanged` がページ遷移と非同期に
     発火するため、稀に「画面は表示済み・currentUser はまだ null」のウィンドウがある
3. **datetime-local 入力の罠**
   - 「開始」「終了」両方とも未入力でクリックすると HTML5 `required` でブラウザがネイティブ
     バリデーション表示を出すが、ステータスメッセージが見えにくくユーザーに「効かない」と
     映る
4. **成功フィードバック皆無**
   - 作成成功時のトースト・「○ 件目の枠を追加しました」表示が無いため、リストが
     リフレッシュ直後の一瞬で空に見えると「効かなかった」と感じる
   - 既存 `notificationStore` (zustand) があれば再利用する

### 修正方針

1. **成功フィードバックを追加** — `notificationStore.show({ type: 'success', message: '枠を追加しました' })` (既存 store 流用)
2. **トークン取得の失敗を表面化** — `authHeaders()` で `currentUser` が null なら
   `await firebaseAuth.authStateReady?.()` で確実に初期化を待つ。それでも null なら
   `Error('not authenticated')` を throw して `SlotForm` で「ログインし直してください」と
   表示する
3. **`onCreated()` を try/catch で囲み、refresh 失敗は warn ログのみ** (作成自体は成功して
   いるので、リスト更新失敗で全体を fail させない)
4. **ボタンに `busy` 中は spinner と「作成中…」ラベル** (既にあるが副次的に押下感を強化)
5. **datetime-local の検証強化** — 開始 < 終了でないとフロントでブロック (`new Date()` 比較)

### 変更対象ファイル

- `frontend/src/app/admin/lessons/_components/SlotForm.tsx`
- `frontend/src/lib/booking.ts` (`authHeaders` に `authStateReady` 待機追加)
- `frontend/src/stores/notificationStore.ts` (流用、変更なしの想定)

---

## Verification

### 手動 E2E (Playwright)

```
1. https://english-cafe.bz-kz.com にログイン (admin)
2. ヘッダーのユーザー名をクリック → ドロップダウン開く
3. ドロップダウン外の場所をクリック → 閉じる ✅
4. 再度開いて Link 「マイページ」クリック → 遷移後ドロップダウンは閉じている ✅
5. /admin/lessons へ移動 → 新規枠フォームに値入力 → 作成 ✅ → 成功トースト + 一覧追加
6. 枠詳細ページ → 「枠を閉じる」 → 確認 → 一覧へ遷移 + その枠は一覧から消えている ✅
```

### 自動テスト

- `frontend/__tests__/components/layout/Header.test.tsx` を追加 (dropdown open/close)
- `frontend/__tests__/app/admin/lessons/SlotForm.test.tsx` を追加 (validation + success path)

両方とも jest + @testing-library/react で記述。

### 非機能

- TypeScript strict: `npx tsc --noEmit` で 0 error
- ESLint: `npm run lint` で 0 warning
- 既存 jest + Playwright e2e が緑のまま

---

## Out of Scope

以下は機能 4a / 4b / 4c で扱う:

- 30分コマ × 14日 のグリッド UI
- Cloud Scheduler 自動枠生成
- 月次 quota / プラン / Stripe 連動
- 24h キャンセル制限

## Critical Files

- `/Users/kz/work/english-caf/kz-bz-english2/frontend/src/app/admin/lessons/[id]/page.tsx`
- `/Users/kz/work/english-caf/kz-bz-english2/frontend/src/app/admin/lessons/_components/SlotForm.tsx`
- `/Users/kz/work/english-caf/kz-bz-english2/frontend/src/components/layout/Header.tsx`
- `/Users/kz/work/english-caf/kz-bz-english2/frontend/src/lib/booking.ts`
- `/Users/kz/work/english-caf/kz-bz-english2/frontend/src/stores/notificationStore.ts`
- `/Users/kz/work/english-caf/kz-bz-english2/frontend/src/hooks/useAdminGuard.ts`
