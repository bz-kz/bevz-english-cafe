# ローカル開発ガイド

## 概要

このドキュメントでは、ローカル環境でのCI/CDワークフローのテストと開発について説明します。

## 前提条件

- Node.js 20+
- Python 3.11+
- uv (Python package manager)
- Docker & Docker Compose
- Git

## セットアップ

### 1. 依存関係のインストール

```bash
# 全体のセットアップ
npm run setup

# または個別に
npm run setup:frontend
npm run setup:backend
```

### 2. 開発環境の起動

```bash
# Docker Composeで全サービス起動
npm run dev

# または個別に
npm run dev:frontend  # フロントエンド開発サーバー
npm run dev:backend   # バックエンド開発サーバー
```

## ローカルCI/CDテスト

### 1. 簡易CI実行

```bash
# ローカルでCI/CDパイプラインをシミュレート
npm run ci:local
```

このスクリプトは以下を実行します：
- 環境チェック
- 依存関係インストール
- リント・フォーマットチェック
- ユニットテスト
- ビルドテスト
- YAMLバリデーション
- Dockerビルドテスト
- セキュリティチェック

### 2. GitHub Actions ローカル実行 (act)

```bash
# actのセットアップ（初回のみ）
npm run ci:setup-act

# 全ワークフロー実行
npm run ci:act

# PR用ワークフロー実行
npm run ci:act-pr

# 利用可能なワークフロー一覧
npm run ci:act-list
```

### 3. YAML検証

```bash
# YAMLファイルのリント
npm run yaml:lint

# YAMLファイルのフォーマット
npm run yaml:format
```

## 個別テスト

### フロントエンド

```bash
cd frontend

# 開発サーバー起動
npm run dev

# テスト実行
npm run test
npm run test:watch
npm run test:ci

# E2Eテスト
npm run test:e2e
npm run test:e2e:ui

# リント・フォーマット
npm run lint
npm run format
npm run format:check

# ビルド
npm run build
```

### バックエンド

```bash
cd backend

# 開発サーバー起動
uv run uvicorn app.main:app --reload

# テスト実行
uv run pytest
uv run pytest --cov=app --cov-report=html

# リント・フォーマット
uv run ruff check .
uv run ruff format .

# セキュリティチェック
uv run safety check
```

## Docker開発

### 基本操作

```bash
# サービス起動
npm run docker:up

# サービス停止
npm run docker:down

# ログ確認
npm run docker:logs

# イメージ再ビルド
npm run docker:build
```

### 本番用イメージテスト

```bash
# 本番用イメージビルド
docker build -f frontend/Dockerfile.prod -t english-cafe-frontend:prod frontend/
docker build -f backend/Dockerfile.prod -t english-cafe-backend:prod backend/

# 本番用イメージ実行
docker run -p 3000:3000 english-cafe-frontend:prod
docker run -p 8000:8000 english-cafe-backend:prod
```

## VS Code統合

### 推奨拡張機能

- ESLint
- Prettier
- Python
- Ruff
- Docker
- YAML
- GitHub Actions

### タスク実行

`Ctrl+Shift+P` → `Tasks: Run Task` で以下のタスクを実行できます：

- **Run Local CI**: ローカルCI実行
- **Setup Act**: GitHub Actions ローカル実行環境セットアップ
- **Run Act**: GitHub Actions ローカル実行
- **Validate YAML Workflows**: ワークフローファイル検証

### デバッグ設定

- **Next.js**: フロントエンドデバッグ
- **FastAPI**: バックエンドデバッグ
- **Pytest**: テストデバッグ

## トラブルシューティング

### よくある問題

#### 1. Node.js依存関係エラー

```bash
# node_modulesクリア
npm run clean:frontend
npm run setup:frontend
```

#### 2. Python依存関係エラー

```bash
# 仮想環境クリア
npm run clean:backend
npm run setup:backend
```

#### 3. Dockerエラー

```bash
# Dockerリセット
docker-compose down -v
docker system prune -f
npm run docker:build
```

#### 4. ポート競合

```bash
# 使用中のポート確認
lsof -i :3000  # フロントエンド
lsof -i :8000  # バックエンド
lsof -i :5432  # PostgreSQL
```

### パフォーマンス最適化

#### 1. 依存関係キャッシュ

```bash
# npmキャッシュクリア
npm cache clean --force

# uvキャッシュクリア
uv cache clean
```

#### 2. Dockerレイヤーキャッシュ

```bash
# ビルドキャッシュ利用
docker-compose build --parallel

# キャッシュなしビルド
docker-compose build --no-cache
```

## 継続的改善

### メトリクス監視

- **テストカバレッジ**: 80%以上を維持
- **ビルド時間**: 5分以内を目標
- **Lighthouse スコア**: 90以上を維持

### 品質ゲート

- **リント**: エラー0、警告最小限
- **テスト**: 全テスト通過
- **セキュリティ**: 高リスク脆弱性0
- **型チェック**: TypeScript/Python型エラー0

## 参考リンク

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [act - Run GitHub Actions locally](https://github.com/nektos/act)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Next.js Documentation](https://nextjs.org/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [uv Documentation](https://docs.astral.sh/uv/)