# 英会話カフェWebサイト

英会話カフェの集客を目的としたWebサイトプロジェクト。モダンなフロントエンド技術とPython/FastAPIを使用したモノレポ構成。

## 🚀 技術スタック

### フロントエンド
- **Next.js 14** (App Router) - React フレームワーク
- **TypeScript** - 型安全性
- **Tailwind CSS** - スタイリング
- **Framer Motion** - アニメーション
- **Zustand** - 状態管理

### バックエンド
- **Python 3.12** - プログラミング言語
- **uv** - 高速Pythonパッケージマネージャー
- **FastAPI** - Web APIフレームワーク
- **SQLAlchemy** - ORM
- **PostgreSQL** - データベース
- **Alembic** - マイグレーション

### インフラ
- **Docker** - 開発環境
- **Vercel** - フロントエンドデプロイ（無料プラン）
- **Render** - バックエンドデプロイ（無料プラン）

## 📁 プロジェクト構造

```
english-cafe-website/
├── frontend/          # Next.js フロントエンド
├── backend/           # FastAPI バックエンド
├── shared/            # 共通型定義・設定
├── .kiro/             # Kiro設定・仕様書
└── docker-compose.yml # Docker設定
```

## 🛠️ 開発環境セットアップ

### 前提条件
- Docker & Docker Compose
- Node.js 20+
- Python 3.12+
- uv (Pythonパッケージマネージャー)

### 1. リポジトリクローン
```bash
git clone <repository-url>
cd english-cafe-website
```

### 2. 環境変数設定
```bash
cp .env.example .env
# .envファイルを編集して必要な値を設定
```

### 3. Docker環境起動
```bash
# 全サービス起動
npm run dev

# または個別起動
docker-compose up -d
```

### 4. 依存関係インストール（ローカル開発用）
```bash
# フロントエンド
cd frontend && npm install

# バックエンド（uvを使用）
cd backend && uv sync
```

### uvのインストール
```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# pip経由
pip install uv
```

## 🔧 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# 個別起動
npm run dev:frontend  # フロントエンドのみ
npm run dev:backend   # バックエンドのみ（uv使用）

# ビルド
npm run build

# テスト実行
npm run test

# リント・フォーマット
npm run lint
npm run format
```

## 📊 アクセス情報

- **フロントエンド**: http://localhost:3000
- **バックエンドAPI**: http://localhost:8000
- **API文書**: http://localhost:8000/docs
- **PostgreSQL**: localhost:5432

## 🧪 テスト

```bash
# 全テスト実行
npm run test

# フロントエンドテスト
cd frontend && npm test

# バックエンドテスト
cd backend && uv run pytest

# E2Eテスト
cd frontend && npm run test:e2e
```

## 📝 API仕様

FastAPIの自動生成ドキュメント: http://localhost:8000/docs

## 🚀 デプロイ

### フロントエンド (Vercel)
```bash
# Vercel CLI使用
vercel --prod
```

### バックエンド (Render)
- GitHubリポジトリ連携で自動デプロイ
- `render.yaml`設定ファイル使用

## 📋 機能一覧

### Phase 1: 集客サイト
- [x] ランディングページ
- [x] 講師紹介
- [x] レッスン情報
- [x] 問い合わせ機能
- [x] アクセス情報
- [x] SNS連携
- [x] YouTube動画埋め込み
- [x] レスポンシブ対応

### Phase 2: 将来拡張
- [ ] ユーザー登録
- [ ] レッスン予約
- [ ] 決済機能
- [ ] AIチャットボット

## 🔒 セキュリティ

- XSS対策（入力値サニタイゼーション）
- CSRF対策（トークン検証）
- SQLインジェクション対策
- レート制限
- セキュリティヘッダー設定

## 📄 ライセンス

Private Project

## 🤝 コントリビューション

1. フィーチャーブランチ作成
2. 変更実装
3. テスト追加
4. プルリクエスト作成

## 📞 サポート

プロジェクトに関する質問は、GitHubのIssuesまでお願いします。