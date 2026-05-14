# 英会話カフェWebサイト

英会話カフェの集客を目的とした Web サイトプロジェクト。Next.js フロントエンドと FastAPI バックエンドのモノレポ構成。

## 🚀 技術スタック

### フロントエンド
- **Next.js 14** (App Router) — React フレームワーク
- **TypeScript** — 型安全性
- **Tailwind CSS** — スタイリング
- **Framer Motion** — アニメーション
- **Zustand** — 状態管理

### バックエンド
- **Python 3.12** — プログラミング言語
- **uv** — 高速 Python パッケージマネージャー
- **FastAPI** — Web API フレームワーク
- **google-cloud-firestore** — Firestore Native client (AsyncClient)

### インフラ
- **Docker / docker-compose** — ローカル開発環境 (FastAPI + Firestore Emulator)
- **Vercel** — フロントエンドデプロイ
- **GCP Cloud Run** (`asia-northeast1`) — バックエンドデプロイ
- **GCP Firestore Native** (`asia-northeast1`) — データストア
- **HCP Terraform** + Terragrunt — インフラ管理 (`terraform/`)
- **GCP Workload Identity Federation** — HCP → GCP 認証
- **GCP Billing budget + Cloud Function killswitch** — 月 ¥2000 を超えたら課金 disable (`terraform/envs/prod/billing/`)

## 📁 プロジェクト構造

```
english-cafe-website/
├── frontend/          # Next.js フロントエンド
├── backend/           # FastAPI バックエンド (DDD レイヤリング)
├── shared/            # 共通型定義・設定
├── terraform/         # インフラ (HCP Terraform + Terragrunt)
├── docs/              # 運用ドキュメント
└── docker-compose.yml # ローカル開発環境
```

詳細なアーキテクチャは `CLAUDE.md` を参照。

## 🛠️ 開発環境セットアップ

### 前提条件
- Docker & Docker Compose
- Node.js 20+
- Python 3.12+
- uv (Python パッケージマネージャー)

### 1. リポジトリクローン
```bash
git clone <repository-url>
cd english-cafe-website
```

### 2. 環境変数設定
```bash
cp .env.example .env
# .env を編集して必要な値を設定
```

### 3. Docker 環境起動 (Firestore Emulator + backend + frontend)
```bash
npm run dev   # docker-compose up -d
```

### 4. 依存関係インストール (ローカル debug 用)
```bash
# フロントエンド
cd frontend && npm install

# バックエンド (uv)
cd backend && uv sync
```

### uv のインストール
```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

## 🔧 開発コマンド

```bash
# 開発サーバー起動 (docker-compose)
npm run dev

# 個別起動
npm run dev:frontend   # Next.js
npm run dev:backend    # FastAPI (uv run uvicorn)

# テスト
npm run test                                       # frontend jest + backend pytest
cd backend && uv run pytest                        # backend のみ
cd frontend && npm test -- path/to/file.test.ts    # 個別 jest
cd frontend && npm run test:e2e                    # Playwright

# Lint / format
npm run lint
npm run format
```

## 📊 ローカルアクセス情報

- **フロントエンド**: http://localhost:3010
- **バックエンド API**: http://localhost:8010
- **API ドキュメント (Swagger)**: http://localhost:8010/docs
- **Firestore Emulator**: localhost:8080 (UI なし、REST API のみ)

## 📝 API 仕様

FastAPI の自動生成ドキュメント: http://localhost:8010/docs

本番 API: https://api.bz-kz.com/docs

## 🚀 デプロイ

### フロントエンド → Vercel
- Vercel root directory は `frontend/`
- 詳細: [`VERCEL_DEPLOYMENT.md`](./VERCEL_DEPLOYMENT.md)
- 環境変数は HCP Terraform workspace `english-cafe-prod-vercel` の `env_vars` HCL 変数で管理 (terraform/envs/prod/vercel)

### バックエンド → GCP Cloud Run
- Service: `english-cafe-api` in `asia-northeast1`
- Custom domain: https://api.bz-kz.com (Google managed cert)
- イメージ: Artifact Registry `asia-northeast1-docker.pkg.dev/english-cafe-496209/english-cafe/api`
- 初回 bootstrap 手順: [`docs/cloud-run-bootstrap.md`](./docs/cloud-run-bootstrap.md)
- Terraform スタック: `terraform/envs/prod/{wif,firestore,cloudrun,billing}/`

## 🔒 セキュリティ

- XSS 対策 (zod スキーマ + DOMPurify)
- レート制限 (slowapi)
- セキュリティヘッダー (`frontend/next.config.js` の `headers()`)
- 月次コスト上限 ¥2000 (超過時 billing 自動 disable)

## 📄 ライセンス

Private Project
