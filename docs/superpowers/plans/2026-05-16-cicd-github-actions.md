# CI/CD GitHub Actions + WIF → Cloud Run (Sub-project A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `main` push touching `backend/**`, GitHub Actions runs CI (ruff+mypy+pytest with Firestore emulator) and, if green, authenticates to GCP via WIF (keyless), builds the backend image, pushes to Artifact Registry, and deploys to Cloud Run via `gcloud run services update`.

**Architecture:** Add a GitHub OIDC provider + dedicated deployer SA to the EXISTING `terraform/modules/gcp-wif` pool (HCP provider/SA/condition untouched — additive). One workflow file with `test` → `deploy` jobs; deploy gated on test, WIF auth, image tag = git SHA, deploy via `gcloud run services update` (matches the `lifecycle.ignore_changes` contract).

**Tech Stack:** GitHub Actions, GCP Workload Identity Federation, Terraform/Terragrunt, `google-github-actions/auth@v2` + `setup-gcloud@v2`, Docker (`backend/Dockerfile.prod`), uv.

**Spec:** [`docs/superpowers/specs/2026-05-16-cicd-github-actions-design.md`](../specs/2026-05-16-cicd-github-actions-design.md)

> **PREREQUISITE (C2):** PR #18 (`fix/phone-roundtrip-test`) must be merged to `main` before this workflow's first `main` run, else `pytest -q` is permanently red (the phone test). This plan creates the workflow on a branch; the workflow only actually runs once its PR is merged. Note this in the PR body; do not block plan execution on it.

---

## File Structure

### Modify
- `terraform/modules/gcp-wif/main.tf` — append GitHub provider + deployer SA + 2 IAM bindings (existing resources untouched)
- `terraform/modules/gcp-wif/variables.tf` — 4 new variables (defaults except `github_repository`)
- `terraform/modules/gcp-wif/outputs.tf` — 2 new outputs
- `terraform/envs/prod/wif/terragrunt.hcl` — add `github_repository` input + bootstrap note
- `CLAUDE.md` — Deployment section: CI/CD note

### Create
- `.github/workflows/backend-deploy.yml`

---

## Task 1: WIF — GitHub provider + deployer SA (terraform module)

**Files:**
- Modify: `terraform/modules/gcp-wif/variables.tf`
- Modify: `terraform/modules/gcp-wif/outputs.tf`
- Modify: `terraform/modules/gcp-wif/main.tf`

- [ ] **Step 1: Add the 4 variables**

Append to `terraform/modules/gcp-wif/variables.tf`:

```hcl
variable "github_provider_id" {
  type        = string
  default     = "github-actions"
  description = "Workload Identity Pool Provider ID for GitHub Actions OIDC."
}

variable "github_repository" {
  type        = string
  description = "GitHub repo (owner/name) allowed to impersonate the deployer SA, e.g. bz-kz/bevz-english-cafe. No default — must be set explicitly."
}

variable "deployer_service_account_id" {
  type        = string
  default     = "github-actions-deployer"
  description = "Account ID (no @domain) for the SA GitHub Actions impersonates via WIF to deploy Cloud Run."
}

variable "deployer_iam_roles" {
  type = list(string)
  default = [
    "roles/run.admin",                # update the Cloud Run service
    "roles/artifactregistry.writer",  # push images
    "roles/iam.serviceAccountUser",   # act as the Cloud Run runtime SA
  ]
  description = "Project-level IAM roles granted to the GitHub Actions deployer SA."
}
```

- [ ] **Step 2: Add the 2 outputs**

Append to `terraform/modules/gcp-wif/outputs.tf`:

```hcl
output "github_wif_provider_name" {
  description = "Full resource name of the GitHub Actions WIF provider (workflow workload_identity_provider value / GitHub Actions var GCP_WIF_PROVIDER)."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deployer_service_account_email" {
  description = "Email of the SA GitHub Actions impersonates to deploy (GitHub Actions var GCP_DEPLOYER_SA)."
  value       = google_service_account.deployer.email
}
```

- [ ] **Step 3: Append the GitHub provider + deployer SA + bindings to main.tf**

Append to `terraform/modules/gcp-wif/main.tf` (do NOT modify any existing resource — additive only; reuses `google_iam_workload_identity_pool.hcp`):

```hcl
# --- GitHub Actions OIDC (sub-project A: backend CI/CD) ---
# Second provider on the SAME pool. GCP namespaces principals per-provider, so
# google.subject = assertion.sub on both providers does not collide (issuers
# differ: app.terraform.io vs token.actions.githubusercontent.com). The HCP
# provider/runner SA/attribute_condition above are intentionally untouched.
resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.gcp_project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.hcp.workload_identity_pool_id
  workload_identity_pool_provider_id = var.github_provider_id
  display_name                       = "GitHub Actions OIDC"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  attribute_condition = "assertion.repository == \"${var.github_repository}\""
}

# Deployer SA — impersonated by GitHub Actions via WIF. Separate from the HCP
# runner SA (権限分離). Roles limited to what a Cloud Run image swap needs.
resource "google_service_account" "deployer" {
  project      = var.gcp_project_id
  account_id   = var.deployer_service_account_id
  display_name = "GitHub Actions Cloud Run deployer"
  description  = "Impersonated by GitHub Actions (backend-deploy workflow) via Workload Identity Federation"
}

resource "google_project_iam_member" "deployer_roles" {
  for_each = toset(var.deployer_iam_roles)
  project  = var.gcp_project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.deployer.email}"
}

# Only tokens from the configured GitHub repo may impersonate the deployer SA.
resource "google_service_account_iam_member" "github_wif" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.hcp.name}/attribute.repository/${var.github_repository}"
}
```

- [ ] **Step 4: Validate the module (syntax/type)**

Run (the snippets' inline-comment spacing is NOT canonical — `terraform fmt` re-aligns it, so **always run `terraform fmt` first**, then validate, then verify clean):
```bash
cd terraform/modules/gcp-wif
terraform fmt                                   # mandatory — normalises the new blocks
terraform init -backend=false -input=false >/dev/null
terraform validate
terraform fmt -check                            # now must be clean
```
Expected: `terraform validate` → `Success! The configuration is valid.`; the final `terraform fmt -check` exits 0. (Stage the fmt-normalised files in Step 5.)

- [ ] **Step 5: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add terraform/modules/gcp-wif/variables.tf terraform/modules/gcp-wif/outputs.tf terraform/modules/gcp-wif/main.tf
git commit -m "feat(wif): add GitHub Actions OIDC provider + deployer SA (additive)"
```

---

## Task 2: Wire `github_repository` into the wif stack

**Files:**
- Modify: `terraform/envs/prod/wif/terragrunt.hcl`

- [ ] **Step 1: Add the input**

In `terraform/envs/prod/wif/terragrunt.hcl`, change the `inputs = { ... }` block to add `github_repository` (keep existing keys; the other 3 new module vars use their defaults):

```hcl
inputs = {
  gcp_project_id    = local.env.locals.gcp_project_id
  hcp_organization  = local.env.locals.hcp_organization
  github_repository = "bz-kz/bevz-english-cafe"
}
```

- [ ] **Step 2: Update the bootstrap comment**

In the same file, extend the existing bootstrap comment block (the one above `inputs`) with one line:

```
# After apply also copy `github_wif_provider_name` and
# `deployer_service_account_email` outputs into GitHub repo Actions
# Variables as GCP_WIF_PROVIDER and GCP_DEPLOYER_SA (see spec Ops checklist).
```

- [ ] **Step 3: Validate HCL formatting**

Run (installed terragrunt is v1.0.4 — `hcl format`, not the old `hclfmt`/`--terragrunt-*` flags):
```bash
cd "$(git rev-parse --show-toplevel)"
terragrunt hcl format --check --working-dir terraform/envs/prod/wif
```
Expected: exit 0 (no formatting diff). If it reports a diff, run `terragrunt hcl format --working-dir terraform/envs/prod/wif` and re-check.

- [ ] **Step 4: Commit**

```bash
git add terraform/envs/prod/wif/terragrunt.hcl
git commit -m "feat(wif-stack): pass github_repository input for CI/CD deployer"
```

---

## Task 3: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/backend-deploy.yml`

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/backend-deploy.yml`:

```yaml
name: backend-deploy

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - '.github/workflows/backend-deploy.yml'
  workflow_dispatch:

concurrency:
  group: backend-deploy-prod
  cancel-in-progress: false

permissions:
  contents: read
  id-token: write

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Start Firestore emulator
        run: |
          docker run --rm -d --name firestore -p 8080:8080 \
            gcr.io/google.com/cloudsdktool/google-cloud-cli:emulators \
            gcloud emulators firestore start \
              --host-port=0.0.0.0:8080 --project=english-cafe-dev
          for i in $(seq 1 30); do
            if curl -fsS "http://localhost:8080/" >/dev/null 2>&1; then
              echo "emulator up"; break
            fi
            sleep 2
          done

      - uses: astral-sh/setup-uv@v5

      - name: Install backend deps
        working-directory: backend
        run: uv sync --frozen

      - name: Ruff
        working-directory: backend
        run: uv run ruff check .

      - name: Mypy (strict scope)
        working-directory: backend
        run: uv run mypy app/domain app/services

      - name: Pytest (emulator)
        working-directory: backend
        env:
          FIRESTORE_EMULATOR_HOST: localhost:8080
        run: uv run pytest -q

  deploy:
    needs: test
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
          service_account: ${{ vars.GCP_DEPLOYER_SA }}

      - uses: google-github-actions/setup-gcloud@v2

      - name: Build & push image
        run: |
          IMG="asia-northeast1-docker.pkg.dev/english-cafe-496209/english-cafe/api:${GITHUB_SHA}"
          gcloud auth configure-docker asia-northeast1-docker.pkg.dev --quiet
          docker build -f backend/Dockerfile.prod -t "$IMG" backend
          docker push "$IMG"
          echo "IMG=$IMG" >> "$GITHUB_ENV"

      - name: Deploy to Cloud Run
        run: |
          gcloud run services update english-cafe-api \
            --image "$IMG" \
            --region asia-northeast1 \
            --quiet

      - name: Health check
        run: |
          for i in $(seq 1 20); do
            if curl -fsS https://api.bz-kz.com/health >/dev/null; then
              echo "healthy"; exit 0
            fi
            sleep 5
          done
          echo "health check failed after ~100s" >&2
          exit 1
```

- [ ] **Step 2: Validate YAML parses + structure**

Run (system `python3` has no PyYAML — use the backend uv env; cwd becomes `backend`, so the workflow path is `../`):
```bash
cd "$(git rev-parse --show-toplevel)/backend"
uv run python -c "import yaml; d=yaml.safe_load(open('../.github/workflows/backend-deploy.yml')); assert 'jobs' in d and set(d['jobs'])>={'test','deploy'}, d; assert d['jobs']['deploy']['needs']=='test'; assert d['permissions']['id-token']=='write'; print('workflow OK:', list(d['jobs']))"
```
Expected: `workflow OK: ['test', 'deploy']` (no AssertionError / YAML error).

- [ ] **Step 3: Lint the test job locally via act (best-effort, non-blocking)**

Run:
```bash
cd "$(git rev-parse --show-toplevel)"
npm run ci:act 2>&1 | tail -5 || echo "act not set up — skip (deploy job requires WIF, not act-testable; YAML validity already confirmed in Step 2)"
```
Expected: either act runs the `test` job, or the documented skip message. This step is advisory — Step 2 is the gating validation. Do not fail the task if `act` is unavailable.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/backend-deploy.yml
git commit -m "feat(ci): backend-deploy workflow — CI gate + WIF Cloud Run deploy"
```

---

## Task 4: CLAUDE.md note + final verification + PR

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the CI/CD note**

In `CLAUDE.md`, in the `## Deployment` section, immediately after the `- Backend → **GCP Cloud Run** ...` bullet (the one ending "so CD doesn't fight terraform."), insert a new bullet:

```markdown
- **CI/CD (backend)**: `main` push touching `backend/**` (or the workflow file) runs `.github/workflows/backend-deploy.yml` — CI (`ruff` + `mypy app/domain app/services` + `pytest` with Firestore emulator); if green it authenticates via GitHub→GCP **WIF** (keyless, `github-actions-deployer` SA) and `docker build backend/Dockerfile.prod` → Artifact Registry → `gcloud run services update`. Manual run via `workflow_dispatch`. WIF is the GitHub OIDC provider added to `terraform/modules/gcp-wif` (separate from the HCP provider). GitHub repo needs Actions Variables `GCP_WIF_PROVIDER` / `GCP_DEPLOYER_SA` (set from the wif stack outputs after `terragrunt apply`).
```

- [ ] **Step 2: Verify the doc edit + whole-repo terraform fmt**

Run (gcp-wif was already fmt-normalised in Task 1 Step 4, so this should be clean; if Task 1's `terraform fmt` was skipped this will diff — run `terraform fmt -recursive terraform/modules/gcp-wif` then re-check and amend Task 1's commit's staged files):
```bash
cd "$(git rev-parse --show-toplevel)"
grep -q "CI/CD (backend)" CLAUDE.md && echo "CLAUDE.md note present"
terraform fmt -check -recursive terraform/modules/gcp-wif
```
Expected: `CLAUDE.md note present`; `fmt -check` exits 0.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): document backend CI/CD (GitHub Actions + WIF)"
```

- [ ] **Step 4: Push + PR (no merge)**

```bash
git push -u origin <branch>
gh pr create --title "feat(ci): backend CI/CD — GitHub Actions + WIF → Cloud Run (sub-project A)" --body "$(cat <<'EOF'
## Summary
`main` push (backend/**) → CI (ruff + mypy[domain,services] + pytest w/ Firestore emulator) → if green, WIF-auth (keyless) build & `gcloud run services update`. Manual via workflow_dispatch.

## What's included
- `terraform/modules/gcp-wif`: GitHub OIDC provider + `github-actions-deployer` SA + repo-scoped impersonation binding — **additive, HCP provider/runner SA/condition untouched** (independent review confirmed no `google.subject` collision)
- `terraform/envs/prod/wif/terragrunt.hcl`: `github_repository` input
- `.github/workflows/backend-deploy.yml`: test → deploy jobs
- CLAUDE.md Deployment note

## Prerequisite / ordering
- ⚠️ **PR #18 (`fix/phone-roundtrip-test`) must be merged to main first** — otherwise the CI `pytest -q` is permanently red on the phone test and every deploy is blocked.
- CI mypy scope is `app/domain app/services` (enforced strict scope); `app/api` has 6 pre-existing errors and is intentionally NOT gated here.

## Ops (post-merge, user actions — keyless, no JSON keys)
1. `terragrunt apply` the `english-cafe-prod-wif` stack (creates GitHub provider + deployer SA + binding)
2. GitHub repo → Settings → Actions → Variables: `GCP_WIF_PROVIDER` = `github_wif_provider_name` output, `GCP_DEPLOYER_SA` = `deployer_service_account_email` output
3. GitHub repo → Settings → Environments → create `production` (optional reviewers / branch=main)
4. First run via `workflow_dispatch` to smoke-test build→push→update→/health 200

## Test plan
- [x] `terraform validate` + `terraform fmt -check` clean on gcp-wif module
- [x] `terragrunt hclfmt --check` clean on wif stack
- [x] workflow YAML parses; jobs/needs/permissions asserted
- [ ] (post-ops) `workflow_dispatch` end-to-end on a real backend change

## Migration / rollback
All additive. Until ops checklist done, deploy job just fails at auth (no prod impact). Rollback = delete workflow + `terragrunt destroy`-scope the 2 new resources; manual `gcloud run services update` always remains available.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

(Do NOT merge — PR creation only per project rule. Infra change → cross-cutting-reviewer gate applies to the diff before this PR is opened.)

---

## Spec Coverage Self-Check

| Spec requirement | Task |
|---|---|
| GitHub OIDC provider on existing pool, HCP untouched | 1 |
| deployer SA + 3 roles + repo-scoped impersonation | 1 |
| 4 new vars (defaults except github_repository) | 1 |
| 2 new outputs (provider name, SA email) | 1 |
| terragrunt `github_repository` input + bootstrap note | 2 |
| workflow: push backend/** + workflow_dispatch, concurrency, id-token | 3 |
| test job: emulator (--project,--rm) + ruff + mypy[domain,services] (C1) + pytest | 3 |
| deploy job: needs test, WIF auth, build Dockerfile.prod ctx=backend, push, `gcloud run services update`, health check | 3 |
| C2 PR #18 prerequisite documented | header + PR body |
| CLAUDE.md Deployment note | 4 |
| Ops checklist (terragrunt apply, GitHub Variables, environment) | PR body |
| validations: terraform validate/fmt, hclfmt, yaml parse | 1,2,3 |
| no merge, cross-cutting-reviewer gate | 4 |
