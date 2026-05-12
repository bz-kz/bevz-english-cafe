#!/bin/bash

# ローカルでCI/CDワークフローをシミュレートするスクリプト

set -e

echo "🚀 Starting local CI simulation..."

# カラー出力用
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 関数定義
print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 1. 環境チェック
print_step "Checking environment..."

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed"
    exit 1
fi

if ! command -v uv &> /dev/null; then
    print_error "uv is not installed. Please install it first."
    exit 1
fi

if ! command -v docker &> /dev/null; then
    print_warning "Docker is not installed. Skipping Docker-related tests."
    SKIP_DOCKER=true
fi

print_success "Environment check passed"

# 2. 依存関係インストール
print_step "Installing dependencies..."

cd frontend
if [ ! -d "node_modules" ]; then
    npm ci
fi
cd ..

cd backend
if [ ! -d ".venv" ]; then
    uv sync --group dev
fi
cd ..

print_success "Dependencies installed"

# 3. リント・フォーマットチェック
print_step "Running lint and format checks..."

cd frontend
npm run lint
npm run format:check
cd ..

cd backend
uv run ruff check .
uv run ruff format --check .
cd ..

print_success "Lint and format checks passed"

# 4. ユニットテスト
print_step "Running unit tests..."

cd frontend
npm run test:ci
cd ..

cd backend
uv run pytest --cov=app --cov-report=term-missing
cd ..

print_success "Unit tests passed"

# 5. ビルドテスト
print_step "Testing builds..."

cd frontend
npm run build
cd ..

print_success "Build tests passed"

# 6. YAMLバリデーション
print_step "Validating YAML files..."

if command -v yamllint &> /dev/null; then
    yamllint .github/workflows/
else
    print_warning "yamllint not installed. Skipping YAML validation."
    print_warning "Install with: pip install yamllint"
fi

# 7. Dockerテスト（オプション）
if [ "$SKIP_DOCKER" != "true" ]; then
    print_step "Testing Docker builds..."
    
    # 開発用Dockerイメージのビルドテスト
    docker-compose build --no-cache
    
    print_success "Docker build tests passed"
else
    print_warning "Skipping Docker tests"
fi

# 8. セキュリティチェック（オプション）
print_step "Running security checks..."

cd frontend
if npm audit --audit-level=high; then
    print_success "Frontend security check passed"
else
    print_warning "Frontend has security vulnerabilities"
fi
cd ..

cd backend
if uv run safety check; then
    print_success "Backend security check passed"
else
    print_warning "Backend has security vulnerabilities"
fi
cd ..

# 完了
echo ""
print_success "🎉 Local CI simulation completed successfully!"
echo ""
echo "Next steps:"
echo "1. Fix any warnings or errors shown above"
echo "2. Commit your changes"
echo "3. Push to trigger the real CI/CD pipeline"
echo ""
echo "To run individual checks:"
echo "  Frontend lint:   cd frontend && npm run lint"
echo "  Backend lint:    cd backend && uv run ruff check ."
echo "  Frontend test:   cd frontend && npm run test"
echo "  Backend test:    cd backend && uv run pytest"
echo "  Docker build:    docker-compose build"