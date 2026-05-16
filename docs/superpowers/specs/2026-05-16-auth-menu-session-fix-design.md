# Auth: Admin Menu Click Race + Absolute Session Expiry — Design

## Goal

(1) ヘッダのユーザーメニューで「Admin」が稀に選択できない不具合を解消する。(2) 実質無期限のログインセッションに**絶対期限（最終ログインから 24h で強制ログアウト）**を導入する。

## Context（調査確定）

- `frontend/src/stores/authStore.ts:25-34`: `onAuthStateChanged` が `await user.getIdTokenResult()`（admin custom claim 解決＝非同期）後に **1 回の setState** で `{user, isAdmin, loading:false}`。初期 state は `{user:null, isAdmin:false, loading:true}`。`setPersistence` 呼び出しはコードに皆無 → Firebase 既定 `browserLocalPersistence`（IndexedDB・再起動後保持・トークン毎時自動更新で実質無期限）。idle/絶対期限/自動ログアウト無し。backend `verify_id_token` は `check_revoked` 無し（標準 1h トークン）。
- `frontend/src/components/layout/Header.tsx:98-106`: `{isAdmin && (<Link href="/admin/lessons" onClick={closeUserMenu} …>Admin</Link>)}` の条件レンダー。`isAdmin` が false→true に flip すると Admin `<Link>` が mount。**この再レンダーがユーザーのクリックと重なると `<Link>` が unmount/remount し click が握り潰される**＝「Admin が選択できない」。`useAdminGuard` は loading 中 redirect しないため bounce ではなくクリック取りこぼしが主因。
- 外側 mousedown ハンドラ（`Header.tsx:13-32`）は ref 内クリックを閉じないため本不具合の原因ではない（スコープ外）。

## Settled decisions（ユーザー承認済）

| # | 決定 |
|---|---|
| Issue 1 方式 | loading 中は **無効プレースホルダ**（grey の `Admin`・非クリック）でスロットを安定確保 → 解決後 `isAdmin` なら有効 `<Link>`、非 admin なら非表示 |
| Issue 2 ポリシー | **絶対期限で強制ログアウト**（idle 無関係）。期間 **N = 24h**、最終実ログイン（`user.metadata.lastSignInTime`、トークン自動更新では不変）起点 |
| 実装範囲 | frontend のみ（`authStore.ts` + `Header.tsx`）。backend/infra 変更なし＝cross-cutting-reviewer gate 不要、独立 spec/plan レビューのみ |
| persistence | 既定 `browserLocalPersistence` のまま（絶対期限で上限を画すため setPersistence 変更は本件スコープ外） |

## Architecture

### Issue 1 — `Header.tsx` Admin 項目の安定化

`Header` の `useAuthStore` から `loading` も取得。`{isAdmin && <Link/>}` ブロックを以下に置換（マイページ Link と ログアウト button の間、同 className 体系）:

```tsx
{loading ? (
  <span
    aria-disabled="true"
    className="block cursor-default px-3 py-2 text-sm text-gray-400"
  >
    Admin
  </span>
) : (
  isAdmin && (
    <Link
      href="/admin/lessons"
      onClick={closeUserMenu}
      className="block px-3 py-2 text-sm hover:bg-gray-50"
    >
      Admin
    </Link>
  )
)}
```

- loading 中: 視覚的に「未活性の Admin」がスロットに常在（レイアウト安定・押せないと分かる）。
- 解決後（`loading=false`）: admin → 有効 `<Link>`、非 admin → 非表示。
- placeholder→Link の差し替えは「非活性表示中／クリック前」に 1 回起きるだけ。`isAdmin` は `onAuthStateChanged` 由来の単一 setState 後は終端安定（再 flip はサインアウト時のみ）なので、**有効 `<Link>` 表示後のクリックは確実**＝unmount-mid-click 解消。現状（loading 中は項目が「無い」→ ポップインした瞬間クリックで取りこぼし）を、視認可能な非活性スロット化で除去する。

### Issue 2 — `authStore.ts` 絶対 24h 期限

モジュールスコープに定数とタイマー参照、`onAuthStateChanged` を改修:

```ts
const ABSOLUTE_SESSION_MS = 24 * 60 * 60 * 1000;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;

if (typeof window !== 'undefined') {
  onAuthStateChanged(firebaseAuth, async user => {
    if (expiryTimer) {
      clearTimeout(expiryTimer);
      expiryTimer = null;
    }
    if (!user) {
      useAuthStore.setState({ user: null, isAdmin: false, loading: false });
      return;
    }
    const lastSignInMs = Date.parse(user.metadata.lastSignInTime ?? '');
    if (!Number.isNaN(lastSignInMs)) {
      const ageMs = Date.now() - lastSignInMs;
      if (ageMs >= ABSOLUTE_SESSION_MS) {
        useAuthStore.setState({ user: null, isAdmin: false, loading: false });
        await signOut(firebaseAuth); // onAuthStateChanged re-fires with null
        return;
      }
      expiryTimer = setTimeout(() => {
        void signOut(firebaseAuth);
      }, ABSOLUTE_SESSION_MS - ageMs);
    }
    const tokenResult = await user.getIdTokenResult();
    const isAdmin = Boolean(tokenResult.claims.admin);
    useAuthStore.setState({ user, isAdmin, loading: false });
  });
}
```

- `lastSignInTime` は実サインイン時のみ更新（トークン自動更新では不変）→「最終ログインから 24h」を正しく表現。
- `clearTimeout` を毎コールバック先頭で行い、リロード再発火・サインイン/アウト連鎖でのタイマー重複/リークを防止。
- 超過時: 先に logged-out state を set してから `signOut`（loading スピナーで固まらない）。`onAuthStateChanged` が null 再発火し最終的に logged-out 確定。
- `Number.isNaN` ガード: `lastSignInTime` 不正/未定義時は cap をスキップ（fail open。無限 signOut を避ける）。
- 24h = 86,400,000ms < 2^31-1（約 24.8 日）で `setTimeout` 上限内＝チャンク不要。
- ページに留まり続けるケースは setTimeout が、リロード/再訪は `onAuthStateChanged` 再発火＋age 再計算がカバー（>24h なら即時 signOut、未満なら残り時間で再スケジュール）。

## Error handling / risk

| リスク | 対応 |
|---|---|
| placeholder→Link の要素型差し替えで React が当該ノード remount | 差し替えは非活性表示中＝意図クリック前に 1 回。終端安定後の有効 Link クリックは確実。現状の「ポップイン即クリック取りこぼし」より厳密に改善（許容 trade-off、spec 明記）|
| `lastSignInTime` の形式差 | Firebase は UTC 文字列。`Date.parse` で解釈、`Number.isNaN` で不正時 fail open |
| タイマー重複・リーク | コールバック先頭で `clearTimeout`。SPA 内では `onAuthStateChanged` の単一購読のみ |
| 即時 signOut→再発火ループ懸念 | signOut 後は user=null で再発火 → `!user` 分岐で終了。ループしない |
| 既存テスト回帰（Header.test / authStore 利用） | `loading` 追加・条件分岐のみ。`npm run lint`/`npx tsc --noEmit`/`npm test` で検証。既知の firebase jsdom 由来失敗 3 suite は本件無関係（baseline 既存）で 0 regression を確認 |
| backend 連携 | 変更なし。クライアント signOut でトークン送信停止＝サーバは自然に未認証扱い |

## Testing

- `cd frontend && npm run lint && npx tsc --noEmit`（型/lint、`any` 無し）。
- `npm test`（既存 jest、Header.test 含む。0 regression＝baseline と同一の既知 firebase-jsdom 失敗のみ許容、新規失敗なし）。
- 手動/任意: ログイン直後にメニューを開き Admin 非活性→活性化後クリックで `/admin/lessons` 到達；24h 経過相当（`lastSignInTime` を過去にしたモック or 短縮値で）で強制 signOut を確認。e2e 追加は任意（本スコープ必須外）。
- 独立 spec/plan レビュー（別エージェント、自己レビュー禁止）。frontend のみ＝cross-cutting-reviewer gate 不要。

## Files

### Modify
- `frontend/src/stores/authStore.ts`（絶対 24h 期限 + タイマー）
- `frontend/src/components/layout/Header.tsx`（`loading` 取得 + Admin 項目の安定化）

### 明示的に不変
- `frontend/src/lib/firebase.ts`（setPersistence は本件スコープ外）、backend 全般、`shared/`、terraform、`useAdminGuard`、他コンポーネント。

## Out of scope

- `setPersistence`（browserSession/inMemory）— 絶対期限採用のため不要
- idle タイムアウト
- backend 側の token max-age / `check_revoked`
- ヘッダの外側クリック挙動（本不具合の原因でない）
- e2e の必須追加（任意）

## Migration / rollback

frontend 2 ファイルのみ。`git revert` で完全復旧。backend/本番影響なし（クライアント挙動のみ）。
