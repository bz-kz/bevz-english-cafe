# Vercel Frontend Terraform — Design Spec

Date: 2026-05-13
Status: Approved (design)
Scope: Frontend-only Vercel infrastructure as code, with room to add backend (Render) and GitHub stacks later.

## 1. Context

The frontend (`frontend/`, Next.js 14 App Router) is already deployed and running on Vercel under the Hobby plan. The custom domain `english-cafe.bz-kz.com` is live. A previous `terraform/` directory existed but was deleted. We need to (re-)introduce Terraform to manage the Vercel side of the deployment, without disrupting the running site, and with a directory layout that scales to future backend and GitHub stacks.

## 2. Goals and Non-goals

In scope:
- Manage the existing Vercel project, environment variables, and the bound custom domain via Terraform.
- Use HCP Terraform (Terraform Cloud, free plan) for state storage and variable management.
- Adopt a Terragrunt layout that keeps DRY across future stacks/environments.
- Preserve the currently running site — every existing Vercel resource is imported before the first `apply`.

Out of scope (for this spec):
- Backend (Render) and GitHub repository management — directories are reserved but not implemented.
- DNS records on `bz-kz.com` — DNS is managed outside this repo.
- Multi-environment (staging/dev) — `prod` only; layout permits adding environments later.
- Vercel Pro features (Password Protection, Trusted IPs) — Hobby plan only.

## 3. Architecture overview

Layout:

```
terraform/
├── terragrunt.hcl                    # root: remote backend, providers, globals
├── envs/
│   └── prod/
│       ├── env.hcl                   # prod-wide inputs (environment name, tags)
│       └── vercel/
│           └── terragrunt.hcl        # stack entry: source = modules/vercel-project
├── modules/
│   └── vercel-project/
│       ├── versions.tf               # required_providers
│       ├── variables.tf              # inputs
│       ├── main.tf                   # vercel_project + env vars + domain
│       └── outputs.tf
├── .gitignore                        # *.tfstate*, .terraform/, .terragrunt-cache/
└── README.md                         # setup, import workflow, troubleshooting
```

Future additions (no code now, layout only):

```
terraform/
├── modules/
│   ├── github-repository/
│   └── render-service/
└── envs/prod/
    ├── github/terragrunt.hcl
    └── render/terragrunt.hcl
```

Each stack under `envs/prod/<stack>/` owns its own HCP Terraform workspace and its own state. Cross-stack dependencies (e.g. Vercel production URL needed by backend CORS) go through Terragrunt `dependency` blocks, not shared state files.

### Why Terragrunt

Chosen by the user after reviewing alternatives. Trade-off: extra CLI to install, in exchange for DRY backend/provider/inputs across stacks and clean state isolation per stack. The underlying modules are pure Terraform, so a future migration off Terragrunt is mechanical.

## 4. Module: `modules/vercel-project`

Single module that owns the three resource types in scope. Designed to be reusable for future Vercel projects (e.g. a separate marketing site).

### Resources

| Resource | Count | Notes |
|---|---|---|
| `vercel_project.this` | 1 | name, framework=`nextjs`, root_directory=`frontend`, build/install commands, git_repository, optional team_id |
| `vercel_project_environment_variable.this` | `for_each = var.env_vars` | Per-key resource; supports per-target value, sensitive flag |
| `vercel_project_domain.this` | `count = var.custom_domain != "" ? 1 : 0` | Optional; skipped if empty string |

### Inputs (`variables.tf`)

```hcl
variable "project_name"      { type = string }
variable "framework"         { type = string, default = "nextjs" }
variable "root_directory"    { type = string, default = "frontend" }
variable "team_id"           { type = string, default = null }
variable "github_repo"       { type = string }              # "owner/repo"
variable "production_branch" { type = string, default = "main" }
variable "custom_domain"     { type = string, default = "" }

variable "env_vars" {
  description = "Map of Vercel environment variables, keyed by var name."
  type = map(object({
    value     = string
    target    = list(string)               # subset of ["production","preview","development"]
    sensitive = optional(bool, false)
  }))
  default = {}
}
```

### Outputs

- `project_id` — the Vercel project ID (used by future stacks to reference this project).
- `production_url` — `https://<project>.vercel.app` derived URL for downstream CORS / monitoring config.

### Why `map(object)` for env vars

A single map variable keyed by env-var name keeps the stack-level `terragrunt.hcl` readable (one entry per variable, value pulled from HCP Terraform Variables), supports `for_each` cleanly, and makes adding/removing variables a one-line change without renaming resources.

## 5. State backend

HCP Terraform (Terraform Cloud) free plan, configured once in the root `terragrunt.hcl` via `remote_state` block. Each stack's workspace is named `<project>-<env>-<stack>` (e.g. `english-cafe-prod-vercel`). Workspaces are created on first `terragrunt init`.

Variables (Vercel API token, env var values) live in the HCP Terraform workspace Variables UI, marked sensitive where appropriate. Local `terraform.tfvars` is not used; this avoids the risk of accidentally committing credentials.

## 6. Import workflow (mandatory before first apply)

The existing Vercel project must be imported before the first `terragrunt apply`, otherwise Terraform attempts to create a second project with the same name and fails.

Order:

1. `terragrunt init` — initializes the remote backend, creates the HCP Terraform workspace.
2. Enter Vercel API token + non-secret variables into the HCP Terraform workspace UI.
3. Run imports:

```bash
# Project
terragrunt import 'vercel_project.this' <PROJECT_ID>

# Each env var (find IDs via `vercel env ls` or REST API)
terragrunt import 'vercel_project_environment_variable.this["NEXT_PUBLIC_API_URL"]' \
    <PROJECT_ID>/<ENV_VAR_ID>

# Domain
terragrunt import 'vercel_project_domain.this[0]' \
    <PROJECT_ID>/english-cafe.bz-kz.com
```

4. `terragrunt plan` — must show **no changes**. If diffs appear, the code is wrong (the running site is the source of truth at this point) — adjust the module inputs to match reality, do not apply.
5. After plan is clean, future changes go through normal apply.

The README documents the exact commands and how to retrieve IDs from the Vercel CLI/API.

## 7. DNS

`english-cafe.bz-kz.com` is a subdomain of `bz-kz.com`. DNS records (CNAME pointing to Vercel) are managed at the DNS provider for `bz-kz.com`, outside this Terraform configuration. The Vercel-side binding (`vercel_project_domain`) is the only piece this repo manages. The README notes this explicitly so future maintainers don't expect DNS records to live here.

## 8. Environment variables in scope

Inventoried from `frontend/.env.example`. All are managed by Terraform (key + value), with values stored as HCP Terraform variables:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `NEXT_PUBLIC_GOOGLE_VERIFICATION`
- `NEXT_PUBLIC_YANDEX_VERIFICATION`
- `NEXT_PUBLIC_YAHOO_VERIFICATION`
- `NEXT_PUBLIC_TWITTER_HANDLE`
- `NEXT_PUBLIC_YOUTUBE_API_KEY`
- `NEXT_PUBLIC_NEW_RELIC_LICENSE_KEY` (sensitive)
- `NEXT_PUBLIC_NEW_RELIC_APP_ID`
- `NEXT_PUBLIC_GRAFANA_ENDPOINT`
- `NEXT_PUBLIC_GRAFANA_API_KEY` (sensitive)
- `NEXT_PUBLIC_VERCEL_ANALYTICS`

Targets default to `["production","preview","development"]` unless a variable is production-only (e.g. analytics keys). The exact target list per variable is decided when values are imported — `plan` after import will reveal what's currently set on Vercel.

## 9. Required user-provided inputs

To proceed to implementation, the user supplies (via HCP Terraform Variables UI, not in code):

| Name | Source | Example |
|---|---|---|
| Vercel API token | https://vercel.com/account/tokens | `XXXXXXXXXXXXXXXX` |
| Vercel team ID (optional) | Vercel account settings | empty for personal/Hobby |
| Vercel project name | existing project | `english-cafe-frontend` |
| GitHub `owner/repo` | repo URL | `bzkz/english-caf` |
| Custom domain | live | `english-cafe.bz-kz.com` |
| HCP Terraform organization | https://app.terraform.io | `<your-org>` |
| Env var values | current Vercel project settings | per variable |

## 10. Testing

- `terraform fmt -recursive` and `terragrunt hclfmt` — formatting gate.
- `terragrunt run-all validate` — schema validation across stacks.
- `terragrunt run-all plan` — diff against live state.
- Manual review of HCP Terraform Web UI plan before any apply.

No automated test suite is added; Terraform's own plan-then-apply discipline plus the import-then-verify-no-changes step is the safety net for the running site.

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Import wipes/recreates a resource and breaks the live site | Enforce "plan must show no changes after import" as a hard gate before any apply. |
| Secret leaked into state | All sensitive variables marked `sensitive = true`; state lives in HCP Terraform (encrypted at rest); no local `tfvars`. |
| Drift between Vercel UI changes and Terraform code | Document policy: changes go through Terraform once imported. Periodic `terragrunt plan` in CI catches drift. |
| Vercel provider version skew | Pin `vercel/vercel` provider in `versions.tf`; bump deliberately. |
| Future stacks need Vercel outputs | Use Terragrunt `dependency` block; do not enable cross-stack reads via shared state. |

## 12. Extensibility checkpoints

When backend/GitHub stacks are added later:

- New module under `modules/<stack>/`, pure Terraform.
- New stack entry under `envs/prod/<stack>/terragrunt.hcl`, includes root and env.hcl, declares `terraform { source = "../../../modules/<stack>" }`.
- New HCP Terraform workspace (auto-created on first init).
- Cross-stack inputs declared via `dependency` blocks in the consumer stack.

No retroactive changes to the Vercel stack are required.
