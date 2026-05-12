# Render + Terraform 統合ガイド

## 📋 概要

Renderには公式のTerraformプロバイダーが存在しないため、Render APIを使用したカスタムTerraformモジュールを実装しています。このドキュメントでは、RenderサービスをTerraformで管理する方法を説明します。

## 🚨 重要な制限事項

### ❌ 利用できないもの
- **公式Terraformプロバイダー**: 存在しない
- **完全なState管理**: Terraformのstateファイルでの完全な管理は困難
- **リソースのImport**: 既存のRenderリソースのインポート機能なし

### ✅ 実装済みの機能
- **サービス作成・削除**: API経由でのWebサービス管理
- **データベース作成・削除**: PostgreSQLデータベース管理
- **環境変数管理**: サービスの環境変数設定
- **デプロイ設定**: ビルド・スタートコマンド設定

## 🏗️ アーキテクチャ

### カスタムモジュール構成
```
terraform/modules/render/
├── main.tf       # null_resource + local-exec でAPI呼び出し
├── variables.tf  # Render設定用変数
└── outputs.tf    # サービスURL、ID等の出力
```

### 動作原理
1. **null_resource**: Terraformリソースとして管理
2. **local-exec**: curlコマンドでRender API呼び出し
3. **triggers**: 設定変更時の再実行制御
4. **ファイル管理**: サービスIDをローカルファイルで保持

## 🔑 Render API Key取得

### 手順
1. [Render Dashboard](https://dashboard.render.com/) にログイン
2. **Account Settings** → **API Keys**
3. **Create API Key** をクリック
4. 設定:
   - **Name**: `terraform-monitoring`
   - **Permissions**: `Full Access`
5. 生成されたキーをコピー

### API Key形式
```
rnd_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### 接続テスト
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://api.render.com/v1/services"
```

## 🛠️ 設定方法

### 1. terraform.tfvars設定

```hcl
# Render Configuration
render_api_key     = "rnd_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
render_service_name = "english-cafe-api"

# Email Configuration (バックエンド用)
smtp_host     = "smtp.gmail.com"
smtp_port     = "587"
smtp_username = "your-email@gmail.com"
smtp_password = "your-app-password"

# Application Security
app_secret_key = "your-secret-key-for-jwt-and-encryption"
```

### 2. 環境変数での管理（推奨）

```bash
# セキュリティのため環境変数で管理
export TF_VAR_render_api_key="rnd_XXXXXXXX"
export TF_VAR_smtp_username="your-email@gmail.com"
export TF_VAR_smtp_password="your-app-password"
export TF_VAR_app_secret_key="your-secret-key"
```

## 📦 デプロイされるリソース

### Webサービス
- **サービス名**: `english-cafe-api`
- **プラン**: Free (750時間/月)
- **リージョン**: Oregon
- **ランタイム**: Python 3.12
- **自動デプロイ**: GitHub連携

### PostgreSQLデータベース
- **データベース名**: `english-cafe-db`
- **プラン**: Free (1GB)
- **バージョン**: PostgreSQL 15
- **接続**: 自動的にサービスに接続

### 環境変数
```bash
# データベース
DATABASE_URL=postgresql://user:pass@host:5432/db

# New Relic監視
NEW_RELIC_LICENSE_KEY=your-license-key
NEW_RELIC_APP_NAME=english-cafe-prod

# CORS設定
FRONTEND_URL=https://english-cafe.vercel.app

# メール設定
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# セキュリティ
SECRET_KEY=your-secret-key

# 環境
ENVIRONMENT=prod
```

## 🚀 デプロイ手順

### 1. 初回デプロイ

```bash
# 1. 設定ファイル準備
cd terraform/environments/prod
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvars を編集

# 2. Render API接続テスト
curl -H "Authorization: Bearer $TF_VAR_render_api_key" \
     "https://api.render.com/v1/services"

# 3. Terraformデプロイ
./scripts/deploy.sh prod plan
./scripts/deploy.sh prod apply
```

### 2. 設定変更時

```bash
# 環境変数やサービス設定を変更
vim terraform.tfvars

# 変更を適用
./scripts/deploy.sh prod apply
```

### 3. サービス削除

```bash
# 注意: データベースも削除されます
./scripts/destroy.sh prod
```

## 📊 監視統合

### New Relic統合
Renderサービスは自動的にNew Relicと統合されます：

```python
# backend/app/main.py
import newrelic.agent

# New Relic初期化
newrelic.agent.initialize()

@newrelic.agent.function_trace()
def your_function():
    # 関数の実行時間を監視
    pass
```

### ヘルスチェック
```python
# backend/app/main.py
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "english-cafe-api",
        "version": "1.0.0"
    }
```

## 🔧 トラブルシューティング

### よくある問題

#### 1. API認証エラー
```bash
# エラー: 401 Unauthorized
# 解決: API Keyが正しいか確認
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://api.render.com/v1/services"
```

#### 2. サービス作成失敗
```bash
# エラー: Service creation failed
# 原因: GitHubリポジトリへのアクセス権限不足
# 解決: RenderアカウントでGitHub連携を確認
```

#### 3. データベース接続エラー
```bash
# エラー: Database connection failed
# 原因: データベースの初期化中
# 解決: 5-10分待ってから再試行
```

#### 4. 環境変数が反映されない
```bash
# 原因: サービスの再起動が必要
# 解決: Render Dashboardで手動再起動
```

### デバッグ方法

#### ログ確認
```bash
# Render Dashboard → Services → english-cafe-api → Logs
# または
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://api.render.com/v1/services/SERVICE_ID/logs"
```

#### サービス状態確認
```bash
# サービス情報取得
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://api.render.com/v1/services/SERVICE_ID"
```

## 🔄 代替手段

### 1. render.yaml使用
リポジトリルートに`render.yaml`を配置してGit連携：

```yaml
# render.yaml
services:
  - type: web
    name: english-cafe-api
    env: python
    plan: free
    buildCommand: cd backend && pip install -r requirements.txt
    startCommand: cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: NEW_RELIC_LICENSE_KEY
        sync: false
      - key: DATABASE_URL
        fromDatabase:
          name: english-cafe-db
          property: connectionString

databases:
  - name: english-cafe-db
    plan: free
```

### 2. 他のプラットフォーム検討
- **Railway**: 公式Terraformプロバイダーあり
- **Fly.io**: 限定的なTerraformサポート
- **AWS App Runner**: 完全なTerraformサポート

## 📈 スケーリング

### 無料プランの制限
- **Webサービス**: 750時間/月（約31日）
- **データベース**: 1GB ストレージ
- **帯域幅**: 100GB/月
- **スリープ**: 15分間非アクティブ後

### 有料プランへの移行
```hcl
# terraform.tfvars
environment     = "starter"  # $7/月
database_plan   = "starter"  # $7/月
```

## 🔒 セキュリティ

### API Key管理
```bash
# 環境変数で管理（推奨）
export TF_VAR_render_api_key="rnd_XXXXXXXX"

# .gitignoreで除外
echo "*.tfvars" >> .gitignore
```

### 定期的なローテーション
- **API Key**: 3ヶ月毎
- **データベースパスワード**: 6ヶ月毎
- **アプリケーションシークレット**: 6ヶ月毎

## 📚 参考リンク

### 公式ドキュメント
- [Render API Documentation](https://render.com/docs/api)
- [Render Blueprint Specification](https://render.com/docs/blueprint-spec)
- [Render Environment Variables](https://render.com/docs/environment-variables)

### 関連ドキュメント
- [APIキー設定ガイド](./api-keys-setup-guide.md)
- [Terraform監視設計書](./terraform-monitoring-design.md)
- [クイックセットアップ](./quick-setup-checklist.md)

## 📞 サポート

### 技術的な問題
- GitHub Issues: プロジェクトリポジトリ
- Slack: #engineering-support

### Render固有の問題
- [Render Community](https://community.render.com/)
- [Render Support](https://render.com/support)

### 緊急時
- Slack: #prod-alerts
- Email: engineering-team@english-cafe.com