# 英会話カフェ監視システム - Terraform Infrastructure

このディレクトリには、英会話カフェWebサイトの監視システム（Grafana Cloud + New Relic）をデプロイするためのTerraform設定が含まれています。

## 🚀 クイックスタート

### 1. 対話型セットアップ（推奨）

```bash
cd terraform/scripts
./setup.sh
```

### 2. 設定検証

```bash
./validate-config.sh
```

### 3. デプロイ実行

```bash
./deploy-monitoring.sh
```

## 📋 概要

このTerraformコードは以下を自動化します：

- **New Relic**: APM、Browser監視、アラート設定
- **Grafana Cloud**: ダッシュボード、アラートルール、通知設定
- **Vercel**: フロントエンドプロジェクト管理
- **Render**: バックエンドサービス管理（カスタムAPI統合）
- **コスト管理**: 予算アラート、使用量監視

## 🏗️ アーキテクチャ

```
terraform/
├── environments/          # 環境固有の設定
│   └── prod/             # 本番環境
├── modules/              # 再利用可能なTerraformモジュール
│   ├── grafana/         # Grafana Cloud監視設定
│   ├── newrelic/        # New Relic監視設定
│   └── render/          # Render.comデプロイ設定
├── scripts/             # デプロイ・ユーティリティスクリプト
│   ├── setup.sh         # 対話型初期セットアップ
│   ├── validate-config.sh # 設定検証
│   └── deploy-monitoring.sh # デプロイ実行
└── MONITORING_DEPLOYMENT_GUIDE.md # 詳細デプロイガイド
```

## 🚀 クイックスタート

### 1. 前提条件

```bash
# 必要なツールのインストール
brew install terraform awscli jq

# AWSクレデンシャルの設定
aws configure

# Terraformバージョン確認
terraform version  # >= 1.6.0
```

### 2. 環境変数の設定

```bash
# New Relic
export TF_VAR_newrelic_account_id="your-account-id"
export TF_VAR_newrelic_api_key="your-api-key"

# Grafana Cloud
export TF_VAR_grafana_url="https://your-org.grafana.net"
export TF_VAR_grafana_auth_token="your-service-account-token"

# 通知設定
export TF_VAR_slack_webhook_url="<replace-with-real-slack-webhook-url>"
export TF_VAR_admin_email="admin@english-cafe.com"
```

### 3. 設定ファイルの準備

```bash
# 本番環境の設定ファイルをコピー
cd terraform/environments/prod
cp terraform.tfvars.example terraform.tfvars

# 実際の値を設定
vim terraform.tfvars
```

### 4. デプロイ実行

```bash
# 開発環境にプラン実行
./scripts/deploy.sh dev plan

# 本番環境にデプロイ
./scripts/deploy.sh prod apply

# 設定の検証
./scripts/deploy.sh prod validate
```

## 📊 監視内容

### New Relic監視項目

- **APM**: アプリケーションパフォーマンス
- **Browser**: リアルユーザーモニタリング
- **Core Web Vitals**: LCP、FID、CLS
- **エラー追跡**: JavaScript エラー、API エラー
- **ビジネスメトリクス**: レッスン予約、問い合わせ数

### Grafanaダッシュボード

- **パフォーマンス概要**: Web Vitals、レスポンス時間
- **ビジネスメトリクス**: コンバージョン、ユーザーアクション
- **エラー分析**: エラー率、エラー詳細
- **インフラ監視**: CPU、メモリ、ネットワーク

### アラート設定

| メトリクス | Warning | Critical | 通知先 |
|-----------|---------|----------|--------|
| エラー率 | 1% | 2% | Slack + Email |
| レスポンス時間 | 1.5s | 2.0s | Slack + Email |
| LCP | 2.0s | 2.5s | Slack |
| メモリ使用率 | 70% | 80% | Slack + Email |

## 🔧 環境別設定

### 開発環境 (dev)
- 緩いアラート閾値
- Slack通知のみ
- 短いデータ保持期間

### ステージング環境 (staging)
- 本番に近い設定
- 限定的な通知
- 中程度のデータ保持

### 本番環境 (prod)
- 厳しいアラート閾値
- 全通知チャンネル有効
- 長期データ保持
- PagerDuty統合

## 💰 コスト管理

### 無料プラン制限

**New Relic (無料)**
- データ取り込み: 100GB/月
- ユーザー: 1名
- データ保持: 8日間

**Grafana Cloud (無料)**
- メトリクス: 10,000シリーズ
- ログ: 50GB/月
- ダッシュボード: 無制限

**AWS (従量課金)**
- CloudWatch: ~$5-10/月
- SNS: ~$1/月
- Secrets Manager: ~$1/月

### コスト最適化

```bash
# 月次予算アラート設定
monthly_budget_limit = 50  # USD

# 不要なメトリクス削除
terraform plan -target=module.grafana.grafana_dashboard.unused

# リソース使用量確認
terraform output cost_information
```

## 🔒 セキュリティ

### 機密情報管理

```bash
# AWS Secrets Managerに保存
aws secretsmanager create-secret \
  --name "prod/monitoring/secrets" \
  --secret-string '{
    "newrelic_api_key": "your-key",
    "grafana_token": "your-token"
  }'
```

### アクセス制御

```bash
# IP制限設定
allowed_ip_ranges = [
  "10.0.0.0/8",      # 社内ネットワーク
  "203.0.113.0/24"   # オフィスIP
]

# 暗号化有効化
enable_encryption = true
```

## 📚 運用手順

### 日常運用

```bash
# 設定変更の適用
./scripts/deploy.sh prod plan
./scripts/deploy.sh prod apply

# 監視URL確認
./scripts/deploy.sh prod output

# 状態の更新
./scripts/deploy.sh prod refresh
```

### トラブルシューティング

```bash
# 状態確認
terraform show

# リソース一覧
terraform state list

# 特定リソースの詳細
terraform state show module.newrelic.newrelic_application.english_cafe

# 状態の修復
terraform refresh -var-file=terraform.tfvars
```

### 緊急時対応

```bash
# アラート一時停止
terraform apply -target=module.newrelic.newrelic_alert_policy.performance \
  -var="alert_enabled=false"

# 完全削除（緊急時のみ）
./scripts/deploy.sh prod destroy
```

## 🔄 CI/CD統合

### GitHub Actions

```yaml
# .github/workflows/terraform-monitoring.yml
name: Terraform Monitoring

on:
  push:
    branches: [main]
    paths: ['terraform/**']

jobs:
  terraform:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2
      - name: Terraform Plan
        run: ./terraform/scripts/deploy.sh prod plan
      - name: Terraform Apply
        if: github.ref == 'refs/heads/main'
        run: ./terraform/scripts/deploy.sh prod apply true
```

### 自動デプロイ

```bash
# 自動承認でのデプロイ
./scripts/deploy.sh prod apply true

# 検証付きデプロイ
./scripts/deploy.sh prod validate && \
./scripts/deploy.sh prod apply
```

## 📈 監視URL

デプロイ完了後、以下のURLで監視状況を確認できます：

```bash
# 監視URL表示
terraform output monitoring_urls

# 出力例:
# New Relic: https://one.newrelic.com/redirect/entity/...
# Grafana Performance: https://your-org.grafana.net/d/.../
# Grafana Business: https://your-org.grafana.net/d/.../
```

## 🆘 サポート

### よくある問題

1. **Terraform初期化エラー**
   ```bash
   # バックエンド設定の確認
   terraform init -reconfigure
   ```

2. **API認証エラー**
   ```bash
   # 環境変数の確認
   echo $TF_VAR_newrelic_api_key
   echo $TF_VAR_grafana_auth_token
   ```

3. **リソース競合エラー**
   ```bash
   # 状態のインポート
   terraform import module.newrelic.newrelic_application.english_cafe <app_id>
   ```

### ドキュメント

**セットアップガイド:**
- [📋 クイックセットアップ チェックリスト](../docs/quick-setup-checklist.md)
- [🔑 APIキー・トークン設定ガイド](../docs/api-keys-setup-guide.md)
- [🟣 Render + Terraform 統合ガイド](../docs/render-terraform-integration.md)
- [🏗️ 設計書詳細](../docs/terraform-monitoring-design.md)

**公式ドキュメント:**
- [Terraform New Relic Provider](https://registry.terraform.io/providers/newrelic/newrelic/latest/docs)
- [Terraform Grafana Provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs)
- [Terraform Vercel Provider](https://registry.terraform.io/providers/vercel/vercel/latest/docs)

### 連絡先

- 技術的な問題: engineering-team@english-cafe.com
- 緊急時: #prod-alerts (Slack)
- ドキュメント: [Wiki](https://github.com/your-org/english-cafe/wiki)