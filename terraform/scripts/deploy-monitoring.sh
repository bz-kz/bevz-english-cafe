#!/bin/bash

# 監視システムデプロイスクリプト
# 英会話カフェWebサイトのGrafana CloudとNew Relicデプロイメント

set -e

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ログ関数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TERRAFORM_DIR="$PROJECT_ROOT/terraform/environments/prod"

# 前提条件チェック
check_prerequisites() {
    log_info "前提条件をチェックしています..."
    
    # Terraformのチェック
    if ! command -v terraform &> /dev/null; then
        log_error "Terraformがインストールされていません"
        log_info "インストール方法: https://learn.hashicorp.com/tutorials/terraform/install-cli"
        exit 1
    fi
    
    # Terraformバージョンチェック
    TERRAFORM_VERSION=$(terraform version -json | jq -r '.terraform_version')
    REQUIRED_VERSION="1.6.0"
    if ! printf '%s\n%s\n' "$REQUIRED_VERSION" "$TERRAFORM_VERSION" | sort -V -C; then
        log_error "Terraform $REQUIRED_VERSION 以上が必要です（現在: $TERRAFORM_VERSION）"
        exit 1
    fi
    
    # jqのチェック
    if ! command -v jq &> /dev/null; then
        log_error "jqがインストールされていません"
        log_info "インストール方法: sudo apt-get install jq (Ubuntu) または brew install jq (macOS)"
        exit 1
    fi
    
    # Gitのチェック
    if ! command -v git &> /dev/null; then
        log_error "Gitがインストールされていません"
        exit 1
    fi
    
    log_success "前提条件チェック完了"
}

# 設定ファイルチェック
check_config() {
    log_info "設定ファイルをチェックしています..."
    
    cd "$TERRAFORM_DIR"
    
    if [ ! -f "terraform.tfvars" ]; then
        log_error "terraform.tfvarsファイルが見つかりません"
        log_info "terraform.tfvars.exampleをコピーして設定してください:"
        log_info "cp terraform.tfvars.example terraform.tfvars"
        exit 1
    fi
    
    # 必須変数のチェック
    REQUIRED_VARS=(
        "newrelic_account_id"
        "newrelic_api_key"
        "newrelic_license_key"
        "grafana_url"
        "grafana_auth_token"
        "vercel_api_token"
        "render_api_key"
        "github_repository"
        "admin_email"
    )
    
    for var in "${REQUIRED_VARS[@]}"; do
        if ! grep -q "^$var\s*=" terraform.tfvars; then
            log_error "必須変数 '$var' がterraform.tfvarsに設定されていません"
            exit 1
        fi
        
        # 空の値チェック
        value=$(grep "^$var\s*=" terraform.tfvars | cut -d'=' -f2 | tr -d ' "')
        if [ -z "$value" ] || [ "$value" = "your-" ] || [[ "$value" == your-* ]]; then
            log_error "変数 '$var' に実際の値を設定してください"
            exit 1
        fi
    done
    
    log_success "設定ファイルチェック完了"
}

# Terraform初期化
terraform_init() {
    log_info "Terraformを初期化しています..."
    
    cd "$TERRAFORM_DIR"
    
    if [ ! -d ".terraform" ]; then
        terraform init
    else
        terraform init -upgrade
    fi
    
    log_success "Terraform初期化完了"
}

# プランの確認
terraform_plan() {
    log_info "Terraformプランを作成しています..."
    
    cd "$TERRAFORM_DIR"
    
    terraform plan -out=tfplan
    
    log_success "Terraformプラン作成完了"
    log_warning "プランを確認してください。続行しますか？ (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        log_info "デプロイをキャンセルしました"
        exit 0
    fi
}

# デプロイ実行
terraform_apply() {
    log_info "Terraformデプロイを実行しています..."
    
    cd "$TERRAFORM_DIR"
    
    terraform apply tfplan
    
    log_success "Terraformデプロイ完了"
}

# デプロイ後の確認
post_deploy_check() {
    log_info "デプロイ後の確認を実行しています..."
    
    cd "$TERRAFORM_DIR"
    
    # 出力値の取得
    log_info "デプロイされたリソースの情報:"
    terraform output
    
    # New Relicアプリケーションの確認
    if terraform output -raw newrelic_application_id &> /dev/null; then
        APP_ID=$(terraform output -raw newrelic_application_id)
        log_success "New Relicアプリケーション作成完了 (ID: $APP_ID)"
    fi
    
    # Grafanaダッシュボードの確認
    if terraform output -json grafana_dashboard_urls &> /dev/null; then
        log_success "Grafanaダッシュボード作成完了"
        terraform output -json grafana_dashboard_urls | jq -r 'to_entries[] | "\(.key): \(.value)"'
    fi
    
    log_success "デプロイ後確認完了"
}

# メイン関数
main() {
    log_info "英会話カフェ監視システムデプロイを開始します"
    
    check_prerequisites
    check_config
    terraform_init
    terraform_plan
    terraform_apply
    post_deploy_check
    
    log_success "監視システムデプロイが完了しました！"
    log_info "次のステップ:"
    log_info "1. New Relicダッシュボードでアプリケーションを確認"
    log_info "2. Grafanaダッシュボードでメトリクスを確認"
    log_info "3. アラート設定をテスト"
    log_info "4. 詳細は MONITORING_DEPLOYMENT_GUIDE.md を参照"
}

# スクリプト実行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi