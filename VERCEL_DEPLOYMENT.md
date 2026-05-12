# Vercel Deployment Guide

## 🔧 Vercelデプロイ問題の修正が完了しました！

**修正した問題:**
1. ✅ **CSS構文エラー修正**: `performance.css`の不正な`attr()`使用を修正
2. ✅ **Tailwind CSS警告解決**: 非推奨の`@tailwindcss/line-clamp`プラグインを削除
3. ✅ **TypeScript型エラー修正**: 複数のコンポーネントの型定義を修正
4. ✅ **Vercel設定ファイル追加**: `vercel.json`を作成してデプロイ設定を最適化
5. ✅ **ビルド検証**: ローカルでのビルドが正常に完了することを確認

## 必要な環境変数

Vercelダッシュボードで以下の環境変数を設定してください：

### Google Analytics
```
NEXT_PUBLIC_GA_TRACKING_ID=G-XXXXXXXXXX
```

### New Relic監視
```
NEXT_PUBLIC_NEW_RELIC_LICENSE_KEY=your-license-key
NEXT_PUBLIC_NEW_RELIC_APPLICATION_ID=your-app-id
```

### Google検索コンソール
```
NEXT_PUBLIC_GOOGLE_VERIFICATION=your-verification-code
```

## Vercelプロジェクト設定

1. **Root Directory**: `frontend`
2. **Build Command**: `npm run build`
3. **Output Directory**: `.next`
4. **Install Command**: `npm install`
5. **Node.js Version**: `18.x`

## デプロイ設定ファイル

### プロジェクトルート: `vercel.json`
```json
{
  "version": 2,
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "frontend/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### フロントエンド: `frontend/vercel.json`
```json
{
  "version": 2,
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "outputDirectory": ".next"
}
```

## トラブルシューティング

### よくあるエラー

1. **Build failed**: 環境変数が設定されていない
   - 解決: Vercelダッシュボードで環境変数を設定

2. **TypeScript errors**: 型定義の不整合
   - 解決: 修正済み（今回のコミットで解決）

3. **CSS compilation error**: 不正なCSS構文
   - 解決: 修正済み（今回のコミットで解決）

4. **Module not found**: 依存関係の問題
   - 解決: package.jsonの依存関係を確認

## デプロイコマンド

```bash
# Vercel CLIを使用する場合
npx vercel --prod

# または環境変数を指定してデプロイ
npx vercel --prod --env NEXT_PUBLIC_GA_TRACKING_ID=G-XXXXXXXXXX
```

## パフォーマンス最適化

- ✅ 動的インポートによるコード分割
- ✅ 画像最適化（Next.js Image）
- ✅ フォント最適化
- ✅ CSS最適化
- ✅ バンドルサイズ最適化

## 監視とアナリティクス

- Google Analytics 4 設定済み
- New Relic APM 設定済み
- Web Vitals 監視設定済み
- エラー追跡設定済み

これらの修正により、Vercelデプロイが成功するはずです。GitHubでの次回のデプロイを確認してください！