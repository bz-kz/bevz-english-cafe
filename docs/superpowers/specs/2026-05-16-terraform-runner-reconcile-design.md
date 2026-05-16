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

**アンカー**: 既存の「Billing killswitch (one-time bootstrap)」節(billing が Local-execution + 人間の `roles/billing.user` で運用される旨を既述)の末尾、もしくはその直後に新規 `### WIF coverage exceptions` サブ節として、`---` 区切りの前に追記。次の趣旨:

> `english-cafe-prod-billing`（billing-killswitch、`google_billing_account_iam_member` + `google_billing_budget` を含む）と `english-cafe-prod-monthly-quota` は HCP runner-WIF 経由で apply されていない（billing-account スコープ IAM は project-level runner role で表現できないため手動 / ローカル ADC で apply 運用。discover 2026-05-16 で principalSet に両 workspace が不在と確認済）。これらを WIF 化する場合は (1) `allowed_workspaces` に追加、(2) billing-account レベルで runner SA に `roles/billing.admin` 等を別途付与（wif stack の bootstrap が billing-account admin 必須になる）が必要。現状は意図された既知例外。

## Safety / behavior (plan semantics — 正確版)

- `google_project_iam_member` / `google_service_account_iam_member` は **非 authoritative**（個別 member 単位、binding 全体を所有しない）。両者 `for_each = toset(var.*)`。
- **重要 (誤解しやすい点)**: `for_each` の set を増やすと terraform は新キーごとに **`+ create` を plan する**。`terragrunt plan` の出力は **`Plan: 8 to add, 0 to change, 0 to destroy`**(`runner_iam_roles` 7 新キー + `allowed_workspaces` 1 新キー = 計 8)。terraform は `iam_member` のリモート IAM を refresh して「既存だから no-op」とは**しない**。これは **import でも no-op plan でもない**。
- 安全である根拠は plan ではなく **apply の冪等性**: 対象 role/workspace は既に gcloud で付与済 → `iam_member`（非 authoritative）の create は「既存 member を再作成」になりエラーにならず**成功（実 IAM 不変）**。よって 8 creates を apply しても新規付与は実質発生せず（既に存在）、削除も発生しない。
- 既存宣言 7 role / 3 workspace は保持。追加分は discover 実在のものだけ。over-declare（実在しない role/workspace を宣言）はしない — 投機的付与を避け「宣言==実態」を厳守。
- 以降、scheduler-slots 系 role/workspace が wif stack の宣言で再現可能になり、imperative gcloud は不要。

## Error handling / risk

| リスク | 対応 |
|---|---|
| 期待外の plan 内容 | **期待値は `Plan: 8 to add, 0 to change, 0 to destroy`**。8 creates は全て `google_project_iam_member.runner_roles["roles/..."]`(7)と `google_service_account_iam_member.wif_runner["english-cafe-prod-scheduler-slots"]`(1)のみ。**中止条件**: change≠0 / destroy≠0 / create がこの 2 つの for_each map 以外のリソースに及ぶ / create 総数≠8 のいずれか(= discover との乖離 or stale tree)。8 creates 自体は正常 |
| stale branch (#5) | **実装 branch は post-#20 origin/main から作成必須**(PR #20 は merge 済 = commit `7183d9c`)。古いツリーで wif stack を apply すると #20 の `deployer` SA / github provider を巻き戻す。plan は post-#20 ツリーで生成。`git log` に #20 マージが含まれることを確認 |
| #20 の deployer SA grant も create で出る | #20 が追加した `google_project_iam_member`(deployer_roles)も、その workspace が未 apply なら create として並ぶ。post-#20 ツリーで plan すれば #20 由来 create は #20 の wif apply 時に解決済のはず。乖離時は再 discover |
| discover ダンプが古い | spec に取得日 (2026-05-16) を明記。apply 直前に再 discover 推奨(ops 手順) |
| monthly-quota/billing が将来 WIF 必要に | README の既知例外手順に従い別タスク化(本スコープ外) |

## Testing

- `cd terraform/modules/gcp-wif && terraform init -backend=false -input=false && terraform validate && terraform fmt -check -recursive`(構文・型・整形)
- 静的: `variables.tf` の 2 default が discover 14 role / 4 workspace と完全一致(コメント以外)
- **cross-cutting-reviewer 必須**(infra 変更、CLAUDE.md 規定): 差分が `variables.tf` の 2 default + `README.md` 追記のみで、`main.tf`/`outputs.tf`/`terragrunt.hcl` に diff なし、`monitoring.notificationChannelEditor`/monthly-quota/billing を宣言していないこと、既存 7 role / 3 workspace が byte 維持されていることを確認
- ops(私側不可・ユーザー操作): 実装 branch を **post-#20 origin/main** から作成(`git log` に PR #20 マージ `7183d9c` を確認)→ `terragrunt plan`(`english-cafe-prod-wif`)で **`Plan: 8 to add, 0 to change, 0 to destroy`**、8 creates が全て `runner_roles[...]`(7)+`wif_runner["...scheduler-slots"]`(1)のみであることを目視確認(change/destroy が出る・他リソースに create が及ぶ・総数≠8 なら中止して再 discover)→ apply(冪等、実 IAM 不変)

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

- 変更は variables default の値拡張 + README 追記のみ。実装 branch は post-#20 origin/main から作成。
- apply は plan 上 8 creates だが、対象 grant は既に GCP に存在するため `iam_member`（非 authoritative）の create は冪等成功・実 IAM 不変（新規付与・削除ともに実質ゼロ）。
- rollback: `git revert`。terraform state からは新キーが消えるが member は削除されない（非 authoritative）ため実 IAM・本番影響なし。
