# Terraform デプロイガイド

## 🎯 デプロイテスト結果

✅ **Terraform初期化**: 成功  
✅ **Terraform Plan**: 成功  
✅ **設定検証**: 完了

## 📋 実際のデプロイ手順

### 1. APIキーの取得

#### New Relic
```bash
# https://one.newrelic.com/admin-portal/api-keys-ui/api-keys
# 必要な情報:
# - Account ID
# - User API Key  
# - License Key
```

#### Grafana Cloud
```bash
# https://grafana.com/profile/api-keys
# 必要な情報:
# - Organization URL
# - Service Account Token
# - API Key
```

#### Render
```bash
# https://dashboard.render.com/account/settings
# 必要な情報:
# - API Key (rnd_で始まる)
```

#### Vercel
```bash
# https://vercel.com/account/tokens
# 必要な情報:
# - API Token (24文字の16進数)
```

### 2. 設定ファイルの更新

```bash
# terraform.tfvarsファイルを編集
cd terraform/environments/prod
cp terraform.tfvars.example terraform.tfvars

# 実際のAPIキーを設定
vim terraform.tfvars
```

### 3. デプロイ実行

```bash
# 初期化
make tf-init

# プラン確認
make tf-plan

# 適用
make tf-apply
```

### 4. 環境変数を使用する場合

```bash
# 環境変数設定
source ./terraform/scripts/set-env-vars.sh

# または個別設定
export TF_VAR_newrelic_api_key="your-key"
export TF_VAR_grafana_auth_token="your-token"
export TF_VAR_render_api_key="your-key"
export TF_VAR_vercel_api_token="your-token"
```

## 🔧 利用可能なコマンド

```bash
# Makefileコマンド
make tf-init     # Terraform初期化
make tf-plan     # 変更プラン表示
make tf-apply    # 変更適用
make tf-destroy  # リソース削除
make tf-env      # 環境変数設定ガイド

# 直接実行
cd terraform/environments/prod
terraform init
terraform plan
terraform apply
terraform destroy
```

## 📊 作成されるリソース

### 最小構成（テスト済み）
- Vercelプロジェクト
- カスタムドメイン設定

### 完全構成（main-full.tf使用時）
- New Relic監視設定
- Grafanaダッシュボード
- Render API統合
- アラート設定
- 通知設定

## 🛡️ セキュリティ

- `terraform.tfvars`は`.gitignore`で除外済み
- APIキーは環境変数での管理を推奨
- 本番環境では最小権限の原則を適用

## 💰 コスト

現在の設定では全て無料プランを使用：
- Vercel: Free (Hobby Plan)
- Render: Free (750時間/月まで)
- New Relic: Free (100GB/月まで)
- Grafana: Free (10k series まで)

## 🚨 トラブルシューティング

### よくあるエラー

1. **APIキー形式エラー**
   ```
   Error: Invalid api_token
   ```
   → APIキーの形式を確認（Vercelは24文字の16進数）

2. **変数不足エラー**
   ```
   Error: Invalid value for input variable
   ```
   → terraform.tfvarsの必須変数を確認

3. **プロバイダーエラー**
   ```
   Error: Failed to query available provider packages
   ```
   → インターネット接続とプロバイダーバージョンを確認

### 解決方法

```bash
# 設定リセット
rm -rf .terraform .terraform.lock.hcl
terraform init

# 詳細ログ
export TF_LOG=DEBUG
terraform plan
```

## 📚 参考リンク

- [Terraform Documentation](https://www.terraform.io/docs)
- [Vercel Provider](https://registry.terraform.io/providers/vercel/vercel/latest/docs)
- [New Relic Provider](https://registry.terraform.io/providers/newrelic/newrelic/latest/docs)
- [Grafana Provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs)