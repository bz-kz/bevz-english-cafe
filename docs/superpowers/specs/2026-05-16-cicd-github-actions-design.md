# CI/CD — GitHub Actions + WIF → Cloud Run (Sub-project A) Design

## Goal

`main` への backend 変更 push で、GitHub Actions が CI (pytest+ruff+mypy) を実行し、緑なら Workload Identity Federation 経由で GCP 認証して Docker image を build → Artifact Registry push → Cloud Run へ自動 deploy する。鍵レス (SA JSON キー不使用)。

## Context

- Backend は GCP Cloud Run (`asia-northeast1`, service `english-cafe-api`, 独自ドメイン `https://api.bz-kz.com`)。image は Artifact Registry `asia-northeast1-docker.pkg.dev/english-cafe-496209/english-cafe/api:<tag>`。
- 現状 image 切替は手動 `gcloud run services update`。terraform `cloud-run-service` module は `lifecycle.ignore_changes = [containers[0].image]` で CD と競合しない設計 (CLAUDE.md 既定方針)。
- 既存 WIF (`terraform/modules/gcp-wif`) は HCP Terraform OIDC のみ信頼する pool を 1 つ持つ。GitHub Actions 用に同 pool へ provider を**追加**する。
- frontend は Vercel 管理 (terraform + Vercel git 連携) のため本 CI/CD の対象外。backend のみ。

## Settled decisions

| # | 決定 |
|---|---|
| Q-CI1 | `main` push かつ `backend/**`(+ workflow 自身)変更時のみ。CI (pytest+ruff+mypy) **緑が deploy 前提条件**。`workflow_dispatch` で手動実行可 |
| Q-CI2 WIF | 既存 `gcp-wif` pool に GitHub OIDC provider を**追加** (1 pool 多 provider)。既存 HCP provider/SA/`attribute_condition` には一切触れない |
| Q-CI2b Build | GitHub Actions runner で `docker build` → Artifact Registry push (`backend/Dockerfile.prod` 流用、Cloud Build 不使用) |
| Deploy | `gcloud run services update --image`(`gcloud run deploy` でなく)。terraform `ignore_changes` と整合 |
| Branch 限定 | repo 単位 `attribute_condition` + workflow `branches:[main]` + GitHub `production` Environment protection。principalSet の ref 厳格化は任意の追加ハードニングとして記載 |

## Architecture

### WIF + IAM (terraform — `terraform/modules/gcp-wif`)

既存 `main.tf` に**追加**(既存 `google_iam_workload_identity_pool.hcp` を再利用、既存 HCP provider/runner SA/condition は不変):

```hcl
resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.gcp_project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.hcp.workload_identity_pool_id
  workload_identity_pool_provider_id = var.github_provider_id
  display_name                       = "GitHub Actions OIDC"
  oidc { issuer_uri = "https://token.actions.githubusercontent.com" }
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }
  attribute_condition = "assertion.repository == \"${var.github_repository}\""
}

resource "google_service_account" "deployer" {
  project      = var.gcp_project_id
  account_id   = var.deployer_service_account_id
  display_name = "GitHub Actions Cloud Run deployer"
}

resource "google_project_iam_member" "deployer_roles" {
  for_each = toset(var.deployer_iam_roles)
  project  = var.gcp_project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_service_account_iam_member" "github_wif" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.hcp.name}/attribute.repository/${var.github_repository}"
}
```

新規 `variables.tf`:
- `github_provider_id` (string, e.g. `github-actions`)
- `github_repository` (string, e.g. `bz-kz/bevz-english-cafe`)
- `deployer_service_account_id` (string, e.g. `github-actions-deployer`)
- `deployer_iam_roles` (list, default `["roles/run.admin","roles/artifactregistry.writer","roles/iam.serviceAccountUser"]`)

新規 `outputs.tf`:
- `github_wif_provider_name` = `google_iam_workload_identity_pool_provider.github.name` (workflow の `workload_identity_provider`)
- `deployer_service_account_email` = `google_service_account.deployer.email`

`terraform/envs/prod/wif/terragrunt.hcl` の inputs に上記新 var を渡す(`github_repository` 等)。

**信頼境界の根拠**: GitHub provider と HCP provider は同 pool 内で別 namespace。`google.subject` は両者 `assertion.sub` だが provider が分離するため衝突しない。GitHub の `attribute_condition` は repo 完全一致のみ許可。deployer SA は `roles/run.admin` + `roles/artifactregistry.writer` + `roles/iam.serviceAccountUser`(Cloud Run runtime SA を act-as)に限定。HCP runner SA とは別 SA で権限分離。

**任意の追加ハードニング** (spec 内オプション、初期実装はしない): principalSet を `attribute.repository/<repo>` でなく `attribute.ref/refs/heads/main` 限定にすると main 以外の ref からの impersonation を IAM レベルで遮断できる。初期は workflow `branches:[main]` + Environment protection で十分とし、必要なら後続で厳格化。

### Workflow (`.github/workflows/backend-deploy.yml`)

2 job 構成。`permissions: id-token: write`(WIF OIDC 必須) / `contents: read`。`concurrency: backend-deploy-prod` `cancel-in-progress:false`(deploy 途中キャンセル禁止)。

- **job `test`**: `actions/checkout@v4` → Firestore emulator を `docker run`(`gcr.io/google.com/cloudsdktool/google-cloud-cli:emulators`, `gcloud emulators firestore start --host-port=0.0.0.0:8080`)で起動し readiness 待ち → `astral-sh/setup-uv@v5` → `cd backend && uv sync --frozen` → `uv run ruff check .` / `uv run mypy app/domain app/services app/api` / `FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest -q`。
  - emulator を `services:` でなく step の `docker run` にする理由: GitHub Actions `services:` はコンテナの起動コマンドを上書きできず、このイメージは引数で emulator サブコマンドを渡す必要があるため。
  - `FIRESTORE_EMULATOR_HOST` を設定することで emulator-gated テスト(現 203 件)も CI で実行される。
- **job `deploy`** (`needs: test`, `environment: production`): `google-github-actions/auth@v2`(`workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}`, `service_account: ${{ vars.GCP_DEPLOYER_SA }}`)→ `setup-gcloud@v2` → `gcloud auth configure-docker asia-northeast1-docker.pkg.dev` → `docker build -f backend/Dockerfile.prod -t <AR>/api:${GITHUB_SHA} backend` → `docker push` → `gcloud run services update english-cafe-api --image <img> --region asia-northeast1 --quiet` → health check ループ(`curl -fsS https://api.bz-kz.com/health`, 最大 ~100s)。

image tag = `${GITHUB_SHA}`(不変・トレース可能)。`vars.*`(GitHub Actions Variables)を使用 — WIF provider 名と deployer SA email は機微でない(鍵レス)。

### Deploy / rollback

- `gcloud run services update --image` は新 revision を作成し traffic 100% に切替(Cloud Run デフォルト)。
- health check 失敗 → job fail(ただし revision は切替済)。**自動 rollback はしない**(YAGNI)。rollback は `workflow_dispatch` で旧 SHA 再実行、または手動 `gcloud run services update-traffic english-cafe-api --to-revisions <prev>=100`。spec に手順記載のみ。

## Error Handling

| 状況 | 挙動 |
|---|---|
| CI (test job) 失敗 | deploy job は `needs: test` で skip。deploy されない |
| WIF auth 失敗 | deploy job が auth step で fail、image 未 build |
| docker build/push 失敗 | job fail、Cloud Run 未更新 |
| `gcloud run services update` 失敗 | job fail。Cloud Run は旧 revision のまま(update 失敗時は切替らない) |
| health check 失敗 | job fail で可視化。revision は新しいまま → 手動 rollback(手順記載) |
| 同時 push | `concurrency` group で直列化、後発は待機 |

## Testing

- workflow 構文/job 構成: 既存 `scripts/local-ci.sh` / `act`(`npm run ci:act`)で test job をローカル検証。deploy job は WIF 必須で act では検証不可(構文のみ)。
- terraform: `terraform/modules/gcp-wif` の追加リソースは `terragrunt plan`(`english-cafe-prod-wif`)で意図したリソース(github provider + deployer SA + 2 IAM binding)のみ作成されることを確認。既存 HCP リソースに diff が出ないこと(`google_iam_workload_identity_pool.hcp` / HCP provider / runner SA は no-change)。
- 初回 `workflow_dispatch` 手動実行で end-to-end 疎通(build→push→update→health 200)。
- **cross-cutting-reviewer 必須**(infra 変更、CLAUDE.md 規定)。spec 段階は独立レビューエージェント、実装 diff は cross-cutting-reviewer gate。

## Files

### Create
- `.github/workflows/backend-deploy.yml`
- `terraform/modules/gcp-wif/` に追加分(同 `main.tf` への resource 追記、`variables.tf`/`outputs.tf` 追記)

### Modify
- `terraform/modules/gcp-wif/main.tf` (github provider + deployer SA + 2 IAM binding 追加 — 既存 resource 不変)
- `terraform/modules/gcp-wif/variables.tf` (4 新 var)
- `terraform/modules/gcp-wif/outputs.tf` (2 新 output)
- `terraform/envs/prod/wif/terragrunt.hcl` (新 inputs)
- `CLAUDE.md` Deployment 節に CI/CD 2-3 行追記

## Out of Scope

- frontend deploy (Vercel 管理、対象外)
- 自動 rollback / canary / blue-green(YAGNI、手動手順のみ)
- Cloud Build(runner build 採用)
- terraform 自体の CI(本件は backend アプリ deploy のみ。terraform は HCP Terraform 管理が継続)
- PR 時の build 検証(Q-CI1=a、deploy ゲートのみ。PR は既存 lint/test の責務)

## Ops checklist (コード外・ユーザー操作、私側不可)

1. `terraform/envs/prod/wif` を `terragrunt apply`(`english-cafe-prod-wif` workspace)— GitHub provider + deployer SA + IAM binding 作成
2. GitHub repo Settings → Secrets and variables → Actions → **Variables**: `GCP_WIF_PROVIDER`(`github_wif_provider_name` output のフル resource 名)、`GCP_DEPLOYER_SA`(`deployer_service_account_email` output)
3. GitHub repo Settings → Environments → `production` 作成(任意: required reviewers / deployment branch を `main` に限定)
4. 初回 `workflow_dispatch` 手動実行で疎通確認(build→push→update→`/health` 200)

## Migration / Rollback (この変更自体の)

- 全て additive。既存 WIF/HCP リソース・既存手動 deploy フローに影響なし。
- workflow を入れても ops checklist 未完なら deploy job は auth step で fail するだけ(本番影響なし)。
- rollback: workflow ファイル削除 + terraform の追加リソースを `terragrunt destroy` 対象から外す(github provider/deployer SA 削除)。手動 `gcloud run services update` フローは常に併用可能。
