# 🚀 クイックセットアップ チェックリスト

## ✅ 事前準備チェックリスト

### アカウント作成
- [ ] New Relicアカウント（無料プラン）
- [ ] Grafana Cloudアカウント（無料プラン）
- [ ] Vercelアカウント
- [ ] Slackワークスペース

### 必要なツール
- [ ] Terraform >= 1.6
- [ ] curl (API テスト用)
- [ ] jq (JSON処理用)

## 🔑 APIキー取得チェックリスト

### New Relic (3つ)
- [ ] **Account ID**: Account settings → Account ID
- [ ] **User API Key**: API keys → Create a key (User type)
- [ ] **License Key**: API keys → License keys (Browser用)

### Grafana Cloud (2つ)
- [ ] **Grafana URL**: `https://your-org.grafana.net`
- [ ] **Service Account Token**: Administration → Service accounts → Add service account

### Vercel (1つ)
- [ ] **Personal Access Token**: Settings → Tokens → Create Token

### Render (1つ)
- [ ] **API Key**: Account Settings → API Keys → Create API Key

### 通知設定 (2つ)
- [ ] **Slack Webhook URL**: Slack App → Incoming Webhooks
- [ ] **Admin Email**: 管理者メールアドレス

### その他 (1つ)
- [ ] **GitHub Repository**: `owner/repo` 形式

## 🧪 接続テストチェックリスト

### API接続確認
```bash
# New Relic
- [ ] curl -H "Api-Key: YOUR_KEY" "https://api.newrelic.com/v2/applications.json"

# Grafana
- [ ] curl -H "Authorization: Bearer YOUR_TOKEN" "https://your-org.grafana.net/api/org"

# Vercel
- [ ] curl -H "Authorization: Bearer YOUR_TOKEN" "https://api.vercel.com/v2/user"

# Slack
- [ ] curl -X POST -H 'Content-type: application/json' --data '{"text":"test"}' YOUR_WEBHOOK_URL

# Render
- [ ] curl -H "Authorization: Bearer YOUR_API_KEY" "https://api.render.com/v1/services"
```

## 📝 設定ファイル作成チェックリスト

### terraform.tfvars 設定
```bash
- [ ] cd terraform/environments/prod
- [ ] cp terraform.tfvars.example terraform.tfvars
- [ ] 以下の値を設定:
  - [ ] newrelic_account_id
  - [ ] newrelic_api_key
  - [ ] newrelic_license_key
  - [ ] grafana_url
  - [ ] grafana_auth_token
  - [ ] vercel_api_token
  - [ ] render_api_key
  - [ ] github_repository
  - [ ] slack_webhook_url
  - [ ] admin_email
  - [ ] smtp_username
  - [ ] smtp_password
  - [ ] app_secret_key
```

## 🚀 デプロイチェックリスト

### 検証
- [ ] `./scripts/validate.sh prod`
- [ ] 設定ファイルの構文チェック
- [ ] API接続テスト

### デプロイ
- [ ] `./scripts/deploy.sh prod plan`
- [ ] プラン内容の確認
- [ ] `./scripts/deploy.sh prod apply`
- [ ] デプロイ完了確認

### 動作確認
- [ ] New Relicダッシュボード確認
- [ ] Grafanaダッシュボード確認
- [ ] アラート設定確認
- [ ] 通知テスト

## 🔒 セキュリティチェックリスト

### ファイル管理
- [ ] `.gitignore` に `*.tfvars` が含まれている
- [ ] 機密情報がGitにコミットされていない
- [ ] 環境変数での管理を検討

### 権限管理
- [ ] 最小権限の原則を適用
- [ ] 定期的なトークンローテーション計画
- [ ] アクセスログの監視設定

## 📊 監視設定チェックリスト

### ダッシュボード
- [ ] パフォーマンスダッシュボード
- [ ] ビジネスメトリクスダッシュボード
- [ ] エラー監視ダッシュボード

### アラート
- [ ] エラー率アラート
- [ ] レスポンス時間アラート
- [ ] Core Web Vitalsアラート
- [ ] ビジネスメトリクスアラート

### 通知
- [ ] Slack通知設定
- [ ] Email通知設定
- [ ] 通知テスト実行

## 🎯 完了確認

### 最終チェック
- [ ] 全てのサービスが正常に動作
- [ ] 監視データが収集されている
- [ ] アラートが適切に設定されている
- [ ] 通知が正常に送信される
- [ ] ドキュメントが最新

### 運用準備
- [ ] 運用手順書の確認
- [ ] 緊急時対応手順の確認
- [ ] チームメンバーへの共有
- [ ] 定期メンテナンス計画

## 📞 困った時の連絡先

### ドキュメント
- 詳細ガイド: `docs/api-keys-setup-guide.md`
- 設計書: `docs/terraform-monitoring-design.md`
- README: `terraform/README.md`

### サポート
- 技術的な問題: GitHub Issues
- 緊急時: Slack #prod-alerts
- 質問: Slack #engineering-support

---

**🎉 セットアップ完了おめでとうございます！**

英会話カフェWebサイトの監視インフラが正常に構築されました。