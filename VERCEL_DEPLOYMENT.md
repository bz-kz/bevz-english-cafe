# Vercel Deployment Guide

## デプロイ方式

フロントエンドの Vercel デプロイは **Terraform で管理** されています。手動の
`npx vercel --prod` フローや、リポジトリルートの `vercel.json` の
`builds`/`routes` は使いません。

- Terraform スタック: `terraform/envs/prod/vercel/`（HCP ワークスペース
  `english-cafe-prod-vercel`）。
- 環境変数は HCP ワークスペースの `env_vars`（HCL 型）変数で一元管理。
  追加・変更は HCP 上の `env_vars` マップを編集して `terragrunt apply`。
  詳細は [`terraform/README.md`](./terraform/README.md) の Vercel スタック節を参照。
- リポジトリルートの `vercel.json` は **informational のみ**。実際のビルド設定は
  per-app（`frontend/`）で Vercel が解決します。

## プロジェクト設定（参考値）

| 項目 | 値 |
|---|---|
| Root Directory | `frontend` |
| Build Command | `npm run build` |
| Output Directory | `.next` |
| Install Command | `npm install` |
| Node.js Version | `20.x` |

## 環境変数

`env_vars` HCP 変数で管理する主なキー:

```
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_GOOGLE_VERIFICATION=your-verification-code
```

`NEXT_PUBLIC_*` はクライアントバンドルにビルド時に焼き込まれるため、変更後は
Vercel の再ビルド（`main` への push か Redeploy）が必要です。

## トラブルシューティング

1. **Build failed（環境変数未設定）**
   - HCP `env_vars` 変数に不足キーを追加し `terragrunt apply`。
2. **`ENV_CONFLICT`（変数が既に存在）**
   - Vercel UI で手動作成された同名変数を削除してから再 apply するか、
     Terraform state に import する。
3. **env var を変えても反映されない**
   - `NEXT_PUBLIC_*` はビルド時に焼き込まれる。再ビルドをトリガーする。
4. **Module not found（依存関係）**
   - `frontend/package.json` の依存関係を確認。

## パフォーマンス最適化

- 動的インポートによるコード分割
- 画像最適化（Next.js Image）
- フォント最適化 / CSS 最適化 / バンドルサイズ最適化

## 監視とアナリティクス

- Google Analytics 4（`NEXT_PUBLIC_GA_MEASUREMENT_ID`）
- Web Vitals 監視
