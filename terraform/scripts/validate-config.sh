#!/bin/bash

# 監視システム設定検証スクリプト
# デプロイ前の設定値検証とAPI接続テスト

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

# 設定値の読み込み
load_config() {
    cd "$TERRAFORM_DIR"
    
    if [ ! -f "terraform.tfvars" ]; then
        log_error "terraform.tfvarsファイルが見つかりません"
        exit 1
    fi
    
    # 設定値を環境変数として読み込み
    while IFS='=' read -r key value; do
        # コメント行をスキップ
        [[ $key =~ ^#.*$ ]] && continue
        # 空行をスキップ
        [[ -z $key ]] && continue
        
        # 値をクリーンアップ（引用符と空白を削除）
        value=$(echo "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^"//;s/"$//')
        
        # 環境変数として設定
        export "TF_VAR_$key"="$value"
    done < terraform.tfvars
}

# New Relic API接続テスト
test_newrelic_connection() {
    log_info "New Relic API接続をテストしています..."
    
    if [ -z "$TF_VAR_newrelic_api_key" ] || [ -z "$TF_VAR_newrelic_account_id" ]; then
        log_error "New Relic API KeyまたはAccount IDが設定されていません"
        return 1
    fi
    
    # New Relic API テスト
    response=$(curl -s -w "%{http_code}" -o /tmp/nr_test.json \
        -H "Api-Key: $TF_VAR_newrelic_api_key" \
        "https://api.newrelic.com/v2/applications.json")
    
    if [ "$response" = "200" ]; then
        log_success "New Relic API接続成功"
        return 0
    else
        log_error "New Relic API接続失敗 (HTTP: $response)"
        if [ -f /tmp/nr_test.json ]; then
            cat /tmp/nr_test.json
        fi
        return 1
    fi
}

# Grafana API接続テスト
test_grafana_connection() {
    log_info "Grafana API接続をテストしています..."
    
    if [ -z "$TF_VAR_grafana_auth_token" ] || [ -z "$TF_VAR_grafana_url" ]; then
        log_error "Grafana Auth TokenまたはURLが設定されていません"
        return 1
    fi
    
    # Grafana API テスト
    response=$(curl -s -w "%{http_code}" -o /tmp/grafana_test.json \
        -H "Authorization: Bearer $TF_VAR_grafana_auth_token" \
        "$TF_VAR_grafana_url/api/org")
    
    if [ "$response" = "200" ]; then
        log_success "Grafana API接続成功"
        return 0
    else
        log_error "Grafana API接続失敗 (HTTP: $response)"
        if [ -f /tmp/grafana_test.json ]; then
            cat /tmp/grafana_test.json
        fi
        return 1
    fi
}

# Vercel API接続テスト
test_vercel_connection() {
    log_info "Vercel API接続をテストしています..."
    
    if [ -z "$TF_VAR_vercel_api_token" ]; then
        log_error "Vercel API Tokenが設定されていません"
        return 1
    fi
    
    # Vercel API テスト
    response=$(curl -s -w "%{http_code}" -o /tmp/vercel_test.json \
        -H "Authorization: Bearer $TF_VAR_vercel_api_token" \
        "https://api.vercel.com/v2/user")
    
    if [ "$response" = "200" ]; then
        log_success "Vercel API接続成功"
        return 0
    else
        log_error "Vercel API接続失敗 (HTTP: $response)"
        if [ -f /tmp/vercel_test.json ]; then
            cat /tmp/vercel_test.json
        fi
        return 1
    fi
}

# Render API接続テスト
test_render_connection() {
    log_info "Render API接続をテストしています..."
    
    if [ -z "$TF_VAR_render_api_key" ]; then
        log_error "Render API Keyが設定されていません"
        return 1
    fi
    
    # Render API テスト
    response=$(curl -s -w "%{http_code}" -o /tmp/render_test.json \
        -H "Authorization: Bearer $TF_VAR_render_api_key" \
        "https://api.render.com/v1/services")
    
    if [ "$response" = "200" ]; then
        log_success "Render API接続成功"
        return 0
    else
        log_error "Render API接続失敗 (HTTP: $response)"
        if [ -f /tmp/render_test.json ]; then
            cat /tmp/render_test.json
        fi
        return 1
    fi
}

# Slack Webhook テスト
test_slack_webhook() {
    log_info "Slack Webhook接続をテストしています..."
    
    if [ -z "$TF_VAR_slack_webhook_url" ]; then
        log_warning "Slack Webhook URLが設定されていません（オプション）"
        return 0
    fi
    
    # Slack Webhook テスト
    response=$(curl -s -w "%{http_code}" -o /tmp/slack_test.json \
        -X POST \
        -H "Content-type: application/json" \
        --data '{"text":"English Cafe監視システム設定テスト"}' \
        "$TF_VAR_slack_webhook_url")
    
    if [ "$response" = "200" ]; then
        log_success "Slack Webhook接続成功"
        return 0
    else
        log_error "Slack Webhook接続失敗 (HTTP: $response)"
        return 1
    fi
}

# GitHub リポジトリ存在確認
test_github_repository() {
    log_info "GitHub リポジトリ存在確認をしています..."
    
    if [ -z "$TF_VAR_github_repository" ]; then
        log_error "GitHub repositoryが設定されていません"
        return 1
    fi
    
    # GitHub API テスト（認証不要のpublicリポジトリチェック）
    response=$(curl -s -w "%{http_code}" -o /tmp/github_test.json \
        "https://api.github.com/repos/$TF_VAR_github_repository")
    
    if [ "$response" = "200" ]; then
        log_success "GitHub リポジトリ確認成功"
        return 0
    elif [ "$response" = "404" ]; then
        log_error "GitHub リポジトリが見つかりません: $TF_VAR_github_repository"
        return 1
    else
        log_warning "GitHub リポジトリ確認失敗 (HTTP: $response) - プライベートリポジトリの可能性があります"
        return 0
    fi
}

# メール設定確認
test_email_config() {
    log_info "メール設定を確認しています..."
    
    if [ -z "$TF_VAR_admin_email" ]; then
        log_error "Admin emailが設定されていません"
        return 1
    fi
    
    # メールアドレス形式チェック
    if [[ ! "$TF_VAR_admin_email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
        log_error "Admin emailの形式が正しくありません: $TF_VAR_admin_email"
        return 1
    fi
    
    log_success "メール設定確認完了"
    return 0
}

# Terraform設定検証
validate_terraform_config() {
    log_info "Terraform設定を検証しています..."
    
    cd "$TERRAFORM_DIR"
    
    # Terraform validate
    if terraform validate; then
        log_success "Terraform設定検証成功"
        return 0
    else
        log_error "Terraform設定検証失敗"
        return 1
    fi
}

# 設定サマリー表示
show_config_summary() {
    log_info "設定サマリー:"
    echo "----------------------------------------"
    echo "Application Name: ${TF_VAR_application_name:-未設定}"
    echo "New Relic Account ID: ${TF_VAR_newrelic_account_id:-未設定}"
    echo "Grafana URL: ${TF_VAR_grafana_url:-未設定}"
    echo "Vercel Project: ${TF_VAR_vercel_project_name:-未設定}"
    echo "Render Service: ${TF_VAR_render_service_name:-未設定}"
    echo "GitHub Repository: ${TF_VAR_github_repository:-未設定}"
    echo "Admin Email: ${TF_VAR_admin_email:-未設定}"
    echo "Custom Domain: ${TF_VAR_custom_domain:-未設定}"
    echo "----------------------------------------"
}

# クリーンアップ
cleanup() {
    rm -f /tmp/nr_test.json /tmp/grafana_test.json /tmp/vercel_test.json /tmp/render_test.json /tmp/slack_test.json /tmp/github_test.json
}

# メイン関数
main() {
    log_info "監視システム設定検証を開始します"
    
    # 設定読み込み
    load_config
    
    # 設定サマリー表示
    show_config_summary
    
    # 検証実行
    local errors=0
    
    test_newrelic_connection || ((errors++))
    test_grafana_connection || ((errors++))
    test_vercel_connection || ((errors++))
    test_render_connection || ((errors++))
    test_slack_webhook || ((errors++))
    test_github_repository || ((errors++))
    test_email_config || ((errors++))
    validate_terraform_config || ((errors++))
    
    # クリーンアップ
    cleanup
    
    # 結果表示
    if [ $errors -eq 0 ]; then
        log_success "すべての設定検証が完了しました！"
        log_info "デプロイの準備ができています"
        exit 0
    else
        log_error "$errors 個のエラーが見つかりました"
        log_info "エラーを修正してから再度実行してください"
        exit 1
    fi
}

# スクリプト実行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi