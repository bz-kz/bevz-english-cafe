.PHONY: help setup clean dev test lint format docker-up docker-down ci-local setup-act act yaml-lint yaml-format

# デフォルトターゲット
help:
	@echo "Available commands:"
	@echo "  setup       - Install all dependencies"
	@echo "  clean       - Clean all build artifacts"
	@echo "  dev         - Start development servers"
	@echo "  test        - Run all tests"
	@echo "  lint        - Run linters"
	@echo "  format      - Format code"
	@echo "  docker-up   - Start Docker services"
	@echo "  docker-down - Stop Docker services"
	@echo "  ci-local    - Run local CI simulation"
	@echo "  setup-act   - Setup act for local GitHub Actions"
	@echo "  act         - Run GitHub Actions locally"
	@echo "  yaml-lint   - Validate YAML files"
	@echo "  yaml-format - Format YAML files"

# セットアップ
setup:
	@echo "Installing dependencies..."
	npm run setup

# クリーンアップ
clean:
	@echo "Cleaning build artifacts..."
	npm run clean

# 開発サーバー起動
dev:
	@echo "Starting development servers..."
	npm run docker:up

# テスト実行
test:
	@echo "Running tests..."
	npm run test

# リント実行
lint:
	@echo "Running linters..."
	npm run lint

# フォーマット実行
format:
	@echo "Formatting code..."
	npm run format

# Docker起動
docker-up:
	@echo "Starting Docker services..."
	docker-compose up -d

# Docker停止
docker-down:
	@echo "Stopping Docker services..."
	docker-compose down

# 開発環境の完全セットアップ
setup-dev: setup
	@echo "Setting up development environment..."
	cd backend && uv venv && uv sync --group dev
	cd frontend && npm install
	@echo "Development environment setup complete!"

# pre-commitフックのインストール
install-hooks:
	@echo "Installing pre-commit hooks..."
	pip install pre-commit
	pre-commit install

# 依存関係の更新
update-deps:
	@echo "Updating dependencies..."
	cd frontend && npm update
	cd backend && uv sync --upgrade

# ログ確認
logs:
	@echo "Showing Docker logs..."
	docker-compose logs -f

# ローカルCI実行
ci-local:
	@echo "Running local CI simulation..."
	./scripts/local-ci.sh

# GitHub Actions ローカル実行セットアップ
setup-act:
	@echo "Setting up act for local GitHub Actions..."
	./scripts/setup-act.sh

# GitHub Actions ローカル実行
act:
	@echo "Running GitHub Actions locally..."
	act

# YAML検証
yaml-lint:
	@echo "Validating YAML files..."
	yamllint .github/workflows/

# YAML フォーマット
yaml-format:
	@echo "Formatting YAML files..."
	prettier --write '.github/workflows/*.yml'