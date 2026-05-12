# API キー・トークン取得ガイド

## 🔑 必要な認証情報

### 1. New Relic 設定

#### Account ID の取得
1. [New Relic](https://one.newrelic.com/) にログイン
2. 右上のアカウント名をクリック → **Account settings**
3. **Account ID** をコピー

#### User API Key の取得
1. 右上のアカウント名をクリック → **API keys**
2. **Create a key** をクリック
3. 設定:
   - **Key type**: User
   - **Name**: terraform-monitoring
   - **Notes**: Terraform infrastructure management
4. **Create key** をクリックしてキーをコピー

#### License Key の取得
1. 右上のアカウント名をクリック → **API keys**
2. **License keys** タブを選択
3. **Browser** 用のLicense keyをコピー

### 2. Grafana Cloud 設定

#### Grafana URL の確認
- Grafana Cloudのダッシュボード URL
- 例: `https://your-org.grafana.net`

#### Service Account Token の作成
1. [Grafana Cloud](https://grafana.com/) にログイン
2. **Administration** → **Service accounts**
3. **Add service account** をクリック
4. 設定:
   - **Display name**: terraform-monitoring
   - **Role**: Admin
5. **Create** をクリック
6. **Add service account token** をクリック
7. **Generate token** をクリックしてトークンをコピー

#### API Key の作成 (オプション)
1. **Configuration** → **API Keys**
2. **New API Key** をクリック
3. 設定:
   - **Key name**: frontend-integration
   - **Role**: Viewer
4. **Add** をクリックしてキーをコピー

### 3. Vercel 設定

#### Personal Access Token の作成
1. [Vercel](https://vercel.com/) にログイン
2. **Settings** → **Tokens**
3. **Create Token** をクリック
4. 設定:
   - **Token Name**: terraform-monitoring
   - **Scope**: Full Account
   - **Expiration**: No Expiration (推奨)
5. **Create** をクリックしてトークンをコピー

### 4. Slack Webhook 設定

#### Incoming Webhook の作成
1. [Slack API](https://api.slack.com/apps) にアクセス
2. **Create New App** → **From scratch**
3. App名: `English Cafe Monitoring`
4. **Incoming Webhooks** を有効化
5. **Add New Webhook to Workspace**
6. 通知先チャンネルを選択
7. Webhook URL をコピー

## 🔧 terraform.tfvars の設定

```hcl
# Application Configuration
application_name = "english-cafe-prod"

# New Relic Configuration
newrelic_account_id  = "1234567890"  # ← ここに実際のAccount IDを入力
newrelic_api_key     = "NRAK-XXXXX"  # ← ここに実際のUser API Keyを入力
newrelic_license_key = "XXXXX"       # ← ここに実際のLicense Keyを入力

# Grafana Configuration
grafana_url                  = "https://your-org.grafana.net"  # ← 実際のGrafana URLを入力
grafana_auth_token          = "glsa_XXXXX"                     # ← Service Account Tokenを入力
grafana_prometheus_endpoint = "https://prometheus-prod-01-eu-west-0.grafana.net/api/prom"
grafana_api_key            = "eyJrIjoiXXXXX"                  # ← API Keyを入力 (オプション)

# Vercel Configuration
vercel_api_token    = "<your-vercel-personal-access-token>"  # ← Vercel Personal Access Tokenを入力
vercel_project_name = "english-cafe"
custom_domain       = ""             # カスタムドメインがあれば入力

# GitHub Configuration
github_repository = "your-org/english-cafe-website"  # ← 実際のリポジトリ名を入力

# Notification Configuration
slack_webhook_url = "https://hooks.slack.com/services/<your-slack-team>/<your-slack-channel>/<your-webhook-secret>"  # ← Slack Webhook URLを入力
admin_email      = "admin@english-cafe.com"                  # ← 管理者メールアドレスを入力

# その他の設定はデフォルト値を使用
```

## 🔒 セキュリティのベストプラクティス

### 環境変数での管理 (推奨)
```bash
# 機密情報を環境変数で管理
export TF_VAR_newrelic_api_key="NRAK-<your-newrelic-user-api-key>"
export TF_VAR_grafana_auth_token="glsa_<your-grafana-service-account-token>"
export TF_VAR_vercel_api_token="<your-vercel-personal-access-token>"
export TF_VAR_slack_webhook_url="<replace-with-real-slack-webhook-url>"
```

### .gitignore の確認
```bash
# 以下のファイルがgitignoreされていることを確認
*.tfvars
*.tfstate
*.tfstate.*
.terraform/
```

## 🧪 接続テスト

### New Relic API テスト
```bash
curl -H "Api-Key: YOUR_API_KEY" \
     "https://api.newrelic.com/v2/applications.json"
```

### Grafana API テスト
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://your-org.grafana.net/api/org"
```

### Vercel API テスト
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://api.vercel.com/v2/user"
```

## 🚀 デプロイ手順

1. **設定ファイル作成**
   ```bash
   cd terraform/environments/prod
   cp terraform.tfvars.example terraform.tfvars
   # terraform.tfvars を上記の内容で編集
   ```

2. **接続テスト**
   ```bash
   ./scripts/validate.sh prod
   ```

3. **プラン確認**
   ```bash
   ./scripts/deploy.sh prod plan
   ```

4. **デプロイ実行**
   ```bash
   ./scripts/deploy.sh prod apply
   ```

## 🔧 トラブルシューティング

### よくあるエラー

#### New Relic認証エラー
```
Error: 401 Unauthorized
```
→ API Keyが正しいか確認、User API Keyを使用しているか確認

#### Grafana認証エラー
```
Error: 403 Forbidden
```
→ Service Account TokenのRoleがAdminになっているか確認

#### Vercel認証エラー
```
Error: 403 Forbidden
```
→ Personal Access TokenのScopeがFull Accountになっているか確認

### サポート

- 技術的な問題: GitHub Issues
- 緊急時: Slack #prod-alerts チャンネル
- ドキュメント: [Terraform Registry](https://registry.terraform.io/)