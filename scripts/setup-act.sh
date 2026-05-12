#!/bin/bash

# GitHub Actions をローカルで実行するための act ツールセットアップ

set -e

echo "🔧 Setting up act for local GitHub Actions testing..."

# OS検出
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    if command -v brew &> /dev/null; then
        echo "Installing act via Homebrew..."
        brew install act
    else
        echo "Homebrew not found. Please install Homebrew first:"
        echo "https://brew.sh/"
        exit 1
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "Installing act via curl..."
    curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
else
    echo "Unsupported OS. Please install act manually:"
    echo "https://github.com/nektos/act#installation"
    exit 1
fi

# .actrc設定ファイル作成
echo "Creating .actrc configuration..."
cat > .actrc << EOF
# act configuration
-P ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest
-P ubuntu-22.04=ghcr.io/catthehacker/ubuntu:act-22.04
-P ubuntu-20.04=ghcr.io/catthehacker/ubuntu:act-20.04

# 環境変数
--env-file .env.local

# シークレット（ローカル開発用）
--secret-file .secrets.local
EOF

# 環境変数ファイルのテンプレート作成
echo "Creating environment file templates..."
cat > .env.local << EOF
# ローカル開発用環境変数
NODE_ENV=test
PYTHON_ENV=test
DATABASE_URL=postgresql://testuser:testpassword@localhost:5442/testdb
CORS_ORIGINS=http://localhost:3010
EOF

cat > .secrets.local << EOF
# ローカル開発用シークレット（実際の値は入れないでください）
GITHUB_TOKEN=your_github_token_here
CODECOV_TOKEN=your_codecov_token_here
EOF

# .gitignoreに追加
echo "Updating .gitignore..."
if ! grep -q ".actrc" .gitignore; then
    echo "" >> .gitignore
    echo "# act (GitHub Actions local runner)" >> .gitignore
    echo ".actrc" >> .gitignore
    echo ".env.local" >> .gitignore
    echo ".secrets.local" >> .gitignore
fi

echo "✅ act setup completed!"
echo ""
echo "Usage examples:"
echo "  act                          # Run all workflows"
echo "  act -j frontend-test         # Run specific job"
echo "  act pull_request             # Run PR workflows"
echo "  act push                     # Run push workflows"
echo "  act -l                       # List available workflows"
echo "  act --dry-run                # Show what would run"
echo ""
echo "Configuration files created:"
echo "  .actrc         - act configuration"
echo "  .env.local     - environment variables"
echo "  .secrets.local - secrets (add your actual values)"
echo ""
echo "⚠️  Remember to:"
echo "1. Add your actual tokens to .secrets.local"
echo "2. Never commit .secrets.local to git"
echo "3. Start Docker before running act"