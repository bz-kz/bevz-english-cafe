# Terraform-ify Imperative Runner SA State (Sub-project B) Design

## Goal

`terraform/modules/gcp-wif` の `runner_iam_roles` / `allowed_workspaces` の default を、imperative に `gcloud` で付与された実態と一致させ、declared == actual にする。以降の wif stack 再 apply で IAM drift が解消され、HCP runner SA の権限・WIF 信頼が宣言管理下に入る。

## Context

- HCP Terraform は `hcp-terraform-runner@english-cafe-496209.iam.gserviceaccount.com` を WIF で impersonate して各 GCP stack を apply する。
- このモジュールは非 authoritative IAM (`google_project_iam_member` / `google_service_account_iam_member` を `for_each`) のため、宣言外で gcloud 付与した role/workspace は terraform に検知されず、`variables.tf` の default が実態より少ない drift 状態だった。
- sub-project 4a/4b 実装中に scheduler-slots 系 stack の apply を通すため、cloud-function/pubsub/storage 等の role と scheduler-slots workspace が imperative に追加された。

## Discover findings (実 IAM ダンプ、2026-05-16 取得 — 確定根拠)

runner SA に**実際に付与されている** project-level role(`gcloud projects get-iam-policy` より、14):
```
roles/artifactregistry.admin
roles/cloudbuild.builds.editor
roles/cloudfunctions.admin
roles/cloudscheduler.admin
roles/datastore.owner
roles/eventarc.admin
roles/iam.serviceAccountAdmin
roles/iam.serviceAccountUser
roles/iam.workloadIdentityPoolAdmin
roles/pubsub.admin
roles/resourcemanager.projectIamAdmin
roles/run.admin
roles/serviceusage.serviceUsageAdmin
roles/storage.admin
```

runner SA を impersonate 可能な workspace(`gcloud iam service-accounts get-iam-policy` の `roles/iam.workloadIdentityUser` principalSet より、4):
```
english-cafe-prod-wif
english-cafe-prod-firestore
english-cafe-prod-cloudrun
english-cafe-prod-scheduler-slots
```

derive(module リソース型からの論理導出)との照合 (Q-B1=c):
- derive が挙げた `roles/monitoring.notificationChannelEditor` は **実在しない** → 宣言から除外(discover が derive を上書き)。billing-killswitch の通知チャネルは runner-WIF 経由で apply されていない。
- derive 候補だった `english-cafe-prod-monthly-quota` / `english-cafe-prod-billing` は principalSet に**存在しない** → これらは HCP runner-WIF 経由で apply されていない(手動 / ローカル ADC apply)。

## Settled decisions

| # | 決定 |
|---|---|
| Q-B1 | c: derive 叩き台 → discover ダンプで照合・補正。**discover 実態を真実とする** |
| Q-B2 | b: billing-account スコープ IAM (`google_billing_account_iam_member`/`google_billing_budget`) は project-level `runner_iam_roles` で表現不可。billing / monthly-quota の WIF 化は本タスク対象外、`terraform/README.md` に既知例外として明記 |

## Architecture (single change unit)

### `terraform/modules/gcp-wif/variables.tf` — 2 default を実態一致に

`runner_iam_roles` の `default` を discover 確認済 14 role に(既存宣言 7 を保持 + 7 追加。`monitoring.notificationChannelEditor` は加えない):

```hcl
variable "runner_iam_roles" {
  type = list(string)
  default = [
    "roles/datastore.owner",                 # firestore stack
    "roles/run.admin",                       # cloudrun stack
    "roles/iam.serviceAccountAdmin",         # cloudrun stack — create runtime SAs
    "roles/iam.serviceAccountUser",          # cloudrun stack — bind SA to service
    "roles/artifactregistry.admin",          # cloudrun stack — create AR repos
    "roles/iam.workloadIdentityPoolAdmin",   # wif stack itself (re-applies)
    "roles/resourcemanager.projectIamAdmin", # cloudrun stack — bind roles to runtime SA
    "roles/serviceusage.serviceUsageAdmin",  # scheduler-slots — enable APIs
    "roles/pubsub.admin",                    # scheduler-slots — Pub/Sub topic
    "roles/storage.admin",                   # scheduler-slots — Function source bucket
    "roles/cloudfunctions.admin",            # scheduler-slots — Gen2 Function
    "roles/eventarc.admin",                  # scheduler-slots — Gen2 Eventarc trigger
    "roles/cloudbuild.builds.editor",        # scheduler-slots — Gen2 build
    "roles/cloudscheduler.admin",            # scheduler-slots — Scheduler job
  ]
  description = "Project-level IAM roles granted to the HCP runner SA. Union of what every WIF-applied stack needs. Reconciled to actual IAM 2026-05-16 (discover dump)."
}
```

`allowed_workspaces` の `default` を discover 確認済 4 に(既存 3 + scheduler-slots):

```hcl
variable "allowed_workspaces" {
  type = list(string)
  default = [
    "english-cafe-prod-wif",
    "english-cafe-prod-firestore",
    "english-cafe-prod-cloudrun",
    "english-cafe-prod-scheduler-slots", # reconciled — imperative grant declared
  ]
  description = "HCP workspace names allowed to impersonate the runner SA via WIF. Reconciled to actual 2026-05-16. NOTE: monthly-quota / billing are NOT here — they are not applied via HCP runner WIF (see terraform/README.md)."
}
```

`main.tf` / `outputs.tf` / `terragrunt.hcl` は**変更なし**(`for_each` がこの 2 var を消費するだけ)。

### `terraform/README.md` — 既知例外を明記 (Q-B2=b)

WIF / bootstrap セクションに次の趣旨を追記:

> `english-cafe-prod-billing`（billing-killswitch、`google_billing_account_iam_member` + `google_billing_budget` を含む）と `english-cafe-prod-monthly-quota` は HCP runner-WIF 経由で apply されていない（billing-account スコープ IAM は project-level runner role で表現できないため手動 / ローカル ADC で apply 運用）。これらを WIF 化する場合は (1) `allowed_workspaces` に追加、(2) billing-account レベルで runner SA に `roles/billing.admin` 等を別途付与（wif stack の bootstrap が billing-account admin 必須になる）が必要。現状は意図された既知例外。

## Safety / behavior

- `google_project_iam_member` / `google_service_account_iam_member` は **非 authoritative**（個別 member 単位、binding 全体を所有しない）。default を discover 実態に一致させても、対象 role/workspace は既に gcloud 付与済なので `terragrunt plan` は **新規付与 0・削除 0**。terraform state に既存 grant を取り込む（import 相当の no-op）だけ。
- 既存宣言 7 role / 3 workspace は保持。追加分は実在するものだけ。over-declare（実在しない role/workspace を宣言）はしない — 投機的付与を避け「宣言==実態」を厳守。
- 以降、scheduler-slots 系 role/workspace が wif stack の宣言で再現可能になり、imperative gcloud は不要。

## Error handling / risk

| リスク | 対応 |
|---|---|
| plan に予期せぬ create/destroy が出る | apply 前に `terragrunt plan` を必ず人間が確認。create/destroy が出たら（= discover と乖離）apply 中止し再 discover |
| discover ダンプが古い | spec に取得日 (2026-05-16) を明記。apply 直前に再 discover 推奨(ops 手順) |
| monthly-quota/billing が将来 WIF 必要に | README の既知例外手順に従い別タスク化(本スコープ外) |

## Testing

- `cd terraform/modules/gcp-wif && terraform init -backend=false -input=false && terraform validate && terraform fmt -check -recursive`(構文・型・整形)
- 静的: `variables.tf` の 2 default が discover 14 role / 4 workspace と完全一致(コメント以外)
- **cross-cutting-reviewer 必須**(infra 変更、CLAUDE.md 規定): 差分が `variables.tf` の 2 default + `README.md` 追記のみで、`main.tf`/`outputs.tf`/`terragrunt.hcl` に diff なし、`monitoring.notificationChannelEditor`/monthly-quota/billing を宣言していないこと、既存 7 role / 3 workspace が byte 維持されていることを確認
- ops(私側不可・ユーザー操作): `terragrunt apply` 前に `terragrunt plan`(`english-cafe-prod-wif`)で「**add 0 / change 0 / destroy 0**(または既存 grant の state 取り込みのみ)」を目視確認 → apply

## Files

### Modify
- `terraform/modules/gcp-wif/variables.tf`（`runner_iam_roles` default 7→14、`allowed_workspaces` default 3→4、両 description 更新）
- `terraform/README.md`（billing/monthly-quota WIF 非経由の既知例外を追記）

### Unchanged (明示)
- `terraform/modules/gcp-wif/main.tf` / `outputs.tf` / `versions.tf`
- `terraform/envs/prod/wif/terragrunt.hcl`
- 他 module / 他 stack

## Out of Scope

- billing-account レベル IAM の宣言化（Q-B2=b により README 文書化のみ）
- monthly-quota / billing の WIF 化（discover で runner-WIF 非経由と確定）
- per-stack の関数 SA など各 module 内で既に宣言済の IAM
- A (CI/CD) で追加した `github` provider / `deployer` SA（別 PR #20、本タスク非対象）

## Migration / Rollback

- 変更は variables default の値拡張 + README 追記のみ。`iam_member` 非 authoritative により apply は state 取り込み（実害なし）。
- rollback: `git revert`。実 IAM は gcloud 付与のまま残る（terraform が member を削除しない）ため本番影響なし。
