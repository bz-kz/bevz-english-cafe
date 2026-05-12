# 監視システムデプロイメントガイド

このガイドでは、TerraformでGrafana CloudとNew Relicを使用した英会話カフェWebサイトの監視システムをデプロイする方法を説明します。

## 前提条件

### 必要なアカウント

1. **New Relic** (無料アカウント)
   - [New Relic](https://newrelic.com/)でアカウント作成
   - License KeyとAccount IDを取得

2. **Grafana Cloud** (無料アカウント)
   - [Grafana Cloud](https://grafana.com/products/cloud/)でアカウント作成
   - Service Account Tokenを作成

3. **Vercel** (無料アカウント)
   - [Vercel](https://vercel.com/)でアカウント作成
   - API Tokenを取得

4. **Render** (無料アカウント)
   - [Render](https://render.com/)でアカウント作成
   - API Keyを取得

5. **Terraform Cloud** (無料アカウント)
   - [Terraform Cloud](https://app.terraform.io/)でアカウント作成
   - Workspaceを作成

### 必要なツール

- Terraform >= 1.6
- Git
- 任意のテキストエディタ

## セットアップ手順

### 1. リポジトリのクローン

```bash
git clone https://github.com/your-org/english-cafe-website.git
cd english-cafe-website/terraform/environments/prod
```

### 2. 設定ファイルの作成

```bash
# terraform.tfvarsファイルを作成
cp terraform.tfvars.example terraform.tfvars
```

### 3. 設定値の入力

`terraform.tfvars`ファイルを編集して、実際の値を入力します：

```hcl
# Application Configuration
application_name = "english-cafe-prod"

# New Relic Configuration
newrelic_account_id  = "1234567"  # New Relic Account ID
newrelic_api_key     = "NRAK-XXXXX"  # New Relic User API Key
newrelic_license_key = "eu01xxXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXNRAL"  # New Relic License Key

# Grafana Configuration
grafana_url                  = "https://your-org.grafana.net"
grafana_auth_token          = "glsa_XXXXX"  # Grafana Service Account Token
grafana_prometheus_endpoint = "https://prometheus-prod-01-eu-west-0.grafana.net/api/prom"
grafana_api_key            = "eyJrIjoiXXXXX"  # Grafana API Key

# Vercel Configuration
vercel_api_token    = "your-vercel-token"
vercel_project_name = "english-cafe"
custom_domain       = "english-cafe.com"  # Optional

# Render Configuration
render_service_name = "english-cafe-api"
render_api_key     = "rnd_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"

# GitHub Configuration
github_repository = "your-org/english-cafe-website"

# Notification Configuration
slack_webhook_url = "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
admin_email      = "admin@english-cafe.com"

# Email Configuration (for backend)
smtp_username = "your-email@gmail.com"
smtp_password = "your-app-password"

# Application Security
app_secret_key = "your-secret-key-for-jwt-and-encryption"
```

### 4. Terraform Cloudの設定

1. [Terraform Cloud](https://app.terraform.io/)にログイン
2. 新しいOrganization `english-cafe` を作成
3. 新しいWorkspace `monitoring-prod` を作成
4. Workspace設定で以下を設定：
   - Execution Mode: Remote
   - Terraform Version: 1.6.x
   - Environment Variables（センシティブな値）:
     - `TF_VAR_newrelic_api_key`
     - `TF_VAR_newrelic_license_key`
     - `TF_VAR_grafana_auth_token`
     - `TF_VAR_vercel_api_token`
     - `TF_VAR_render_api_key`
     - `TF_VAR_slack_webhook_url`
     - `TF_VAR_smtp_password`
     - `TF_VAR_app_secret_key`

### 5. Terraformの初期化と実行

```bash
# Terraform初期化
terraform init

# プランの確認
terraform plan

# デプロイの実行
terraform apply
```

## 各サービスの設定詳細

### New Relic設定

1. **Account IDの取得**:
   - New Relicダッシュボード → Account settings → Account ID

2. **API Keyの取得**:
   - New Relicダッシュボード → API keys → Create key
   - Type: User key

3. **License Keyの取得**:
   - New Relicダッシュボード → API keys → License keys

### Grafana Cloud設定

1. **Service Account Tokenの作成**:
   - Grafana Cloud → Administration → Service accounts
   - Create service account → Add token
   - Role: Admin

2. **Prometheus Endpointの取得**:
   - Grafana Cloud → Connections → Add new connection → Prometheus
   - Remote write endpointをコピー

### Vercel設定

1. **API Tokenの取得**:
   - Vercel Dashboard → Settings → Tokens
   - Create Token

2. **プロジェクト設定**:
   - GitHub連携を設定
   - 環境変数を設定（Terraformが自動設定）

### Render設定

1. **API Keyの取得**:
   - Render Dashboard → Account Settings → API Keys
   - Create API Key

2. **サービス設定**:
   - GitHub連携を設定
   - 環境変数を設定（Terraformが自動設定）

## デプロイ後の確認

### 1. New Relicダッシュボード

- アプリケーションが表示されることを確認
- アラートポリシーが作成されることを確認
- ダッシュボードが作成されることを確認

### 2. Grafanaダッシュボード

- データソースが接続されることを確認
- ダッシュボードが作成されることを確認
- アラートルールが設定されることを確認

### 3. Vercelプロジェクト

- プロジェクトがデプロイされることを確認
- 環境変数が設定されることを確認
- カスタムドメインが設定されることを確認（設定した場合）

### 4. Renderサービス

- サービスがデプロイされることを確認
- 環境変数が設定されることを確認
- ヘルスチェックが通ることを確認

## トラブルシューティング

### よくある問題

1. **API Key認証エラー**
   - API Keyが正しいことを確認
   - 権限が適切に設定されていることを確認

2. **Terraform Cloud接続エラー**
   - Organization名とWorkspace名が正しいことを確認
   - Terraform Cloudにログインしていることを確認

3. **リソース作成エラー**
   - 無料プランの制限を確認
   - 既存のリソースとの競合を確認

### ログの確認

```bash
# Terraformログの詳細表示
export TF_LOG=DEBUG
terraform apply

# 特定のリソースの状態確認
terraform state show module.newrelic.newrelic_application.english_cafe
```

## 監視の確認

### メトリクスの確認

1. **New Relic**:
   - APM → Applications → english-cafe-prod
   - Browser → Applications → english-cafe-prod

2. **Grafana**:
   - Dashboards → English Cafe - Performance Overview
   - Dashboards → English Cafe - Business Metrics

### アラートのテスト

1. **エラー率アラート**:
   - 意図的にエラーを発生させてアラートをテスト

2. **レスポンス時間アラート**:
   - 負荷をかけてレスポンス時間アラートをテスト

## メンテナンス

### 定期的なタスク

1. **設定の更新**:
   ```bash
   terraform plan
   terraform apply
   ```

2. **状態の確認**:
   ```bash
   terraform refresh
   terraform show
   ```

3. **リソースのクリーンアップ**:
   ```bash
   terraform destroy  # 注意：本番環境では慎重に実行
   ```

## コスト管理

### 無料プランの制限

- **New Relic**: 100GB/月まで無料
- **Grafana Cloud**: 10,000シリーズまで無料
- **Vercel**: Hobbyプランで無料
- **Render**: 750時間/月まで無料
- **Terraform Cloud**: 5ユーザーまで無料

### コスト監視

- 各サービスのダッシュボードで使用量を定期的に確認
- アラートを設定して制限に近づいた場合に通知

## セキュリティ

### ベストプラクティス

1. **API Keyの管理**:
   - Terraform Cloud環境変数で管理
   - 定期的にローテーション

2. **アクセス制御**:
   - 最小権限の原則
   - 定期的な権限レビュー

3. **監査ログ**:
   - 各サービスの監査ログを確認
   - 不審なアクティビティの監視

## サポート

問題が発生した場合は、以下のリソースを参照してください：

- [Terraform Documentation](https://www.terraform.io/docs)
- [New Relic Documentation](https://docs.newrelic.com/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Vercel Documentation](https://vercel.com/docs)
- [Render Documentation](https://render.com/docs)