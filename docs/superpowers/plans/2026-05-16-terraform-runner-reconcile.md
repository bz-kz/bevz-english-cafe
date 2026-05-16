# Terraform-ify Imperative Runner SA State (Sub-project B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile `terraform/modules/gcp-wif/variables.tf` defaults (`runner_iam_roles` 7→14, `allowed_workspaces` 3→4) to the IAM that was discovered actually granted (2026-05-16 dump), and document the billing/monthly-quota WIF non-coverage in `terraform/README.md`.

**Architecture:** Two-default value-expansion in one variables file + one README subsection. Non-authoritative `google_project_iam_member` / `google_service_account_iam_member` via `for_each` — growing the set plans `+ create` per new key (8 total), but the grants already exist in GCP so apply is idempotent (no real IAM change). No `main.tf`/`outputs.tf`/`terragrunt.hcl` change.

**Tech Stack:** Terraform 1.14 / Terragrunt 1.0.4, HCP Terraform WIF.

**Spec:** [`docs/superpowers/specs/2026-05-16-terraform-runner-reconcile-design.md`](../specs/2026-05-16-terraform-runner-reconcile-design.md)

> **BRANCH PREREQUISITE (review C#5):** PR #20 (sub-project A, GitHub WIF provider + deployer SA) is **merged to `main`** (commit `7183d9c`). The implementation branch for this plan MUST be created from **post-#20 `origin/main`** so the wif module already contains #20's `github` provider / `deployer` SA / its 4 new vars. #20's `variables.tf` additions are appended after `allowed_workspaces` and are disjoint from the two defaults this plan edits (clean auto-merge), but applying the wif stack from a pre-#20 tree would revert #20. The subagent-driven controller creates the branch from current `origin/main`; verify `git log --oneline | grep -q 7183d9c` before Task 1.

---

## File Structure

### Modify
- `terraform/modules/gcp-wif/variables.tf` — `runner_iam_roles` default 7→14 + description; `allowed_workspaces` default 3→4 + description
- `terraform/README.md` — add `### WIF coverage exceptions` subsection at the end of the "Billing killswitch (one-time bootstrap)" section (before its closing `---`)

### Explicitly unchanged
- `terraform/modules/gcp-wif/main.tf`, `outputs.tf`, `versions.tf`
- `terraform/envs/prod/wif/terragrunt.hcl`
- everything else

---

## Task 1: Reconcile `runner_iam_roles` + `allowed_workspaces` defaults

**Files:**
- Modify: `terraform/modules/gcp-wif/variables.tf`

- [ ] **Step 0: Confirm post-#20 branch**

Run:
```bash
cd "$(git rev-parse --show-toplevel)"
git log --oneline | grep -q 7183d9c && echo "post-#20 OK" || echo "ABORT: branch is pre-#20, recreate from origin/main"
grep -q 'variable "deployer_iam_roles"' terraform/modules/gcp-wif/variables.tf && echo "deployer var present (post-#20 confirmed)"
```
Expected: `post-#20 OK` and `deployer var present (post-#20 confirmed)`. If not, STOP — branch must be recreated from current `origin/main`.

- [ ] **Step 1: Replace the `runner_iam_roles` block**

In `terraform/modules/gcp-wif/variables.tf`, replace the entire `variable "runner_iam_roles" { ... }` block (the 7-role default + its description) with:

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

- [ ] **Step 2: Replace the `allowed_workspaces` block**

In the same file, replace the entire `variable "allowed_workspaces" { ... }` block with:

```hcl
variable "allowed_workspaces" {
  type = list(string)
  default = [
    "english-cafe-prod-wif",
    "english-cafe-prod-firestore",
    "english-cafe-prod-cloudrun",
    "english-cafe-prod-scheduler-slots", # reconciled — imperative grant declared
  ]
  description = "HCP workspace names allowed to impersonate the runner SA via WIF. Reconciled to actual 2026-05-16. NOTE: monthly-quota / billing are NOT here — they are not applied via HCP runner WIF (see terraform/README.md WIF coverage exceptions)."
}
```

- [ ] **Step 3: Validate + fmt**

Run:
```bash
cd terraform/modules/gcp-wif
terraform fmt
terraform init -backend=false -input=false >/dev/null
terraform validate
terraform fmt -check -recursive
```
Expected: `terraform validate` → `Success! The configuration is valid.`; final `terraform fmt -check -recursive` exits 0.

- [ ] **Step 4: Static count assertions (discover parity)**

Run:
```bash
cd "$(git rev-parse --show-toplevel)"
python3 - <<'PY'
import re
t = open("terraform/modules/gcp-wif/variables.tf").read()
roles = re.search(r'variable "runner_iam_roles".*?default = \[(.*?)\]', t, re.S).group(1)
ws    = re.search(r'variable "allowed_workspaces".*?default = \[(.*?)\]', t, re.S).group(1)
rl = re.findall(r'"(roles/[^"]+)"', roles)
wl = re.findall(r'"(english-cafe-prod-[^"]+)"', ws)
assert len(rl) == 14, (len(rl), rl)
assert "roles/monitoring.notificationChannelEditor" not in rl, "must NOT be declared"
assert {"roles/serviceusage.serviceUsageAdmin","roles/pubsub.admin","roles/storage.admin","roles/cloudfunctions.admin","roles/eventarc.admin","roles/cloudbuild.builds.editor","roles/cloudscheduler.admin"} <= set(rl)
assert wl == ["english-cafe-prod-wif","english-cafe-prod-firestore","english-cafe-prod-cloudrun","english-cafe-prod-scheduler-slots"], wl
print("parity OK: 14 roles / 4 workspaces, no monitoring/monthly-quota/billing")
PY
```
Expected: `parity OK: 14 roles / 4 workspaces, no monitoring/monthly-quota/billing` (no AssertionError). (System `python3` has no extra deps needed here — only stdlib `re`.)

- [ ] **Step 5: Commit**

```bash
git add terraform/modules/gcp-wif/variables.tf
git commit -m "feat(wif): reconcile runner_iam_roles + allowed_workspaces to actual IAM"
```

---

## Task 2: Document WIF coverage exceptions in README

**Files:**
- Modify: `terraform/README.md`

- [ ] **Step 1: Add the subsection**

In `terraform/README.md`, the "### Billing killswitch (one-time bootstrap)" section ends with step 5 (a paragraph ending `...via \`terragrunt apply\`.`) followed by a blank line then a `---` horizontal rule. Insert a new subsection **between step 5's paragraph and that `---`** (i.e., immediately before the `---` that closes the billing section):

```markdown

### WIF coverage exceptions

`english-cafe-prod-billing` (billing-killswitch — includes
`google_billing_account_iam_member` + `google_billing_budget`) and
`english-cafe-prod-monthly-quota` are **not** applied via the HCP runner WIF.
Billing-account-scoped IAM cannot be expressed by the project-level
`runner_iam_roles`, so these stacks are applied manually / with local ADC.
The 2026-05-16 IAM discover confirmed neither workspace is in the runner SA's
`roles/iam.workloadIdentityUser` principalSet. To bring either under WIF later
you must (1) add the workspace to `gcp-wif`'s `allowed_workspaces`, and
(2) grant the runner SA billing-account-level roles (e.g. `roles/billing.admin`)
out of band — which makes the `wif` stack bootstrap itself require
billing-account admin. This is an intentional, documented exception.
```

(The leading blank line in the block separates it from step 5; keep the existing `---` after it intact.)

- [ ] **Step 2: Verify placement**

Run:
```bash
cd "$(git rev-parse --show-toplevel)"
python3 - <<'PY'
import re
t = open("terraform/README.md").read()
assert "### WIF coverage exceptions" in t, "subsection missing"
bk = t.index("### Billing killswitch (one-time bootstrap)")
ex = t.index("### WIF coverage exceptions")
nextrule = t.index("\n---", bk)
# exception subsection must sit inside the billing section, before its closing ---
assert bk < ex < nextrule, (bk, ex, nextrule)
assert "monthly-quota" in t.split("### WIF coverage exceptions")[1].split("---")[0]
print("README placement OK")
PY
```
Expected: `README placement OK` (no AssertionError).

- [ ] **Step 3: Commit**

```bash
git add terraform/README.md
git commit -m "docs(terraform): document billing/monthly-quota WIF coverage exception"
```

---

## Task 3: Final verification + PR

**Files:** none (verification only)

- [ ] **Step 1: Confirm scope — only the 2 intended files changed**

Run:
```bash
cd "$(git rev-parse --show-toplevel)"
git diff --stat origin/main..HEAD -- terraform/ | tail -5
git diff origin/main..HEAD --name-only -- terraform/ | sort
```
Expected: exactly `terraform/modules/gcp-wif/variables.tf` and `terraform/README.md` changed under `terraform/` (no `main.tf`/`outputs.tf`/`terragrunt.hcl`). Plus the spec/plan docs under `docs/`.

- [ ] **Step 2: Confirm existing 7 roles / 3 workspaces preserved (no rename/drop)**

Run:
```bash
cd "$(git rev-parse --show-toplevel)"
git show origin/main:terraform/modules/gcp-wif/variables.tf > /tmp/wif_old.tf
python3 - <<'PY'
import re
def roles(p):
    t=open(p).read()
    return re.findall(r'"(roles/[^"]+)"', re.search(r'runner_iam_roles".*?default = \[(.*?)\]', t, re.S).group(1))
def ws(p):
    t=open(p).read()
    return re.findall(r'"(english-cafe-prod-[^"]+)"', re.search(r'allowed_workspaces".*?default = \[(.*?)\]', t, re.S).group(1))
old_r, new_r = roles("/tmp/wif_old.tf"), roles("terraform/modules/gcp-wif/variables.tf")
old_w, new_w = ws("/tmp/wif_old.tf"), ws("terraform/modules/gcp-wif/variables.tf")
assert set(old_r) <= set(new_r), set(old_r)-set(new_r)   # nothing dropped
assert set(old_w) <= set(new_w), set(old_w)-set(new_w)
assert len(new_r)==14 and len(new_w)==4
print(f"superset OK: roles {len(old_r)}->{len(new_r)}, ws {len(old_w)}->{len(new_w)}")
PY
```
Expected: `superset OK: roles 7->14, ws 3->4`.

- [ ] **Step 3: Push + PR (no merge)**

```bash
git push -u origin <branch>
gh pr create --title "feat(wif): reconcile runner SA IAM to declared state (sub-project B)" --body "$(cat <<'EOF'
## Summary
Reconcile `terraform/modules/gcp-wif/variables.tf` defaults to the IAM actually granted to the HCP runner SA (discovered via `gcloud get-iam-policy` dumps, 2026-05-16): `runner_iam_roles` 7→14, `allowed_workspaces` 3→4 (+`scheduler-slots`). Document billing/monthly-quota WIF non-coverage in `terraform/README.md`.

## What changed
- `runner_iam_roles`: +7 (serviceusage/pubsub/storage/cloudfunctions/eventarc/cloudbuild/cloudscheduler) — all confirmed present in the live IAM dump. `monitoring.notificationChannelEditor` deliberately NOT added (derive over-included it; discover proved it's not granted — billing isn't runner-WIF-applied).
- `allowed_workspaces`: +`english-cafe-prod-scheduler-slots` (the only imperatively-added workspace; monthly-quota/billing confirmed absent from principalSet).
- README: new `### WIF coverage exceptions` subsection (Q-B2=b — billing/monthly-quota are an intentional documented exception).
- `main.tf`/`outputs.tf`/`terragrunt.hcl` unchanged.

## Plan semantics (read before applying — NOT a no-op plan)
`google_project_iam_member` / `_service_account_iam_member` are non-authoritative `for_each`. Growing the set makes terraform plan **`Plan: 8 to add, 0 to change, 0 to destroy`** (7 roles + 1 workspace, as new for_each instances). These are state-only creates: the grants already exist in GCP imperatively, so `iam_member` apply is **idempotent** (re-creating an existing non-authoritative member succeeds, real IAM unchanged). This is NOT an import and NOT a zero-op plan.

## Ops (post-merge, user — terragrunt apply not done by CI/agent)
1. Ensure branch/main is post-#20 (commit `7183d9c`) — this PR is cut from post-#20 `origin/main`.
2. `terragrunt plan` on `english-cafe-prod-wif`. **Accept** iff: `8 to add, 0 to change, 0 to destroy` AND all 8 creates are `google_project_iam_member.runner_roles[...]` (7) / `google_service_account_iam_member.wif_runner["...scheduler-slots"]` (1). **Abort** if change≠0, destroy≠0, any create on other resources, or count≠8 → re-run the discover dumps and reconcile.
3. `terragrunt apply` (idempotent — real IAM unchanged; drift closed).

## Test plan
- [x] `terraform validate` + `terraform fmt -check -recursive` clean
- [x] static parity assertion: 14 roles / 4 workspaces, no monitoring/monthly-quota/billing, existing 7+3 preserved as superset
- [x] scope: only `variables.tf` + `README.md` changed
- [x] cross-cutting-reviewer PASS (infra)
- [ ] (post-merge ops) `terragrunt plan` shows exactly the 8 expected creates

## Migration / rollback
All within variables defaults + README. `iam_member` non-authoritative → apply doesn't change real IAM; `git revert` removes the state keys without deleting members. No prod impact.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

(Do NOT merge — PR creation only per project rule. Infra change → **cross-cutting-reviewer gate before this PR is opened**.)

---

## Spec Coverage Self-Check

| Spec requirement | Task |
|---|---|
| `runner_iam_roles` default → 14 (7+7), monitoring excluded | 1 |
| `allowed_workspaces` default → 4 (+scheduler-slots), monthly-quota/billing excluded | 1 |
| descriptions updated with reconcile note | 1 |
| `main.tf`/`outputs.tf`/`terragrunt.hcl` unchanged | 3 (scope assert) |
| existing 7 roles / 3 workspaces preserved (superset) | 3 |
| README WIF coverage exceptions (Q-B2=b) anchored in billing section | 2 |
| post-#20 branch prerequisite (C#5) | header + Task 1 Step 0 |
| correct plan-semantics wording (C#2) | header + PR body + spec |
| terraform validate/fmt + parity assertions | 1 |
| cross-cutting-reviewer gate, no merge | 3 |
