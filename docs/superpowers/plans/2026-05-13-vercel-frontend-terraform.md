# Vercel Frontend Terraform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a fresh Terragrunt-managed Terraform configuration for the running Vercel frontend project, without disrupting the live site.

**Architecture:** Terragrunt root (`terraform/terragrunt.hcl`) declares the HCP Terraform remote backend and the Vercel provider via `generate` blocks. A single stack `envs/prod/vercel/` references a reusable `modules/vercel-project/` module which owns `vercel_project`, per-key `vercel_project_environment_variable`, and an optional `vercel_project_domain`. Module is pure Terraform — Terragrunt is the orchestration layer only.

**Tech Stack:**
- Terraform `>= 1.6`
- Terragrunt `>= 0.55`
- Vercel Terraform provider `~> 4.0` (current major series, confirmed via context7)
- HCP Terraform (Terraform Cloud) free plan for remote state + variable storage

**Source spec:** `docs/superpowers/specs/2026-05-13-vercel-frontend-terraform-design.md`

**Working directory:** All paths are relative to the repo root `kz-bz-english2/`.

---

## File map

| Path | Responsibility |
|---|---|
| `terraform/.gitignore` | Ignore `.terraform/`, `.terragrunt-cache/`, `*.tfstate*`, `*.tfvars` |
| `terraform/README.md` | Setup, HCP workspace creation, import workflow, troubleshooting |
| `terraform/terragrunt.hcl` | Root: `remote_state` block for HCP, `generate` blocks for provider + common variables |
| `terraform/envs/prod/env.hcl` | prod-wide locals: environment name, tags |
| `terraform/envs/prod/vercel/terragrunt.hcl` | Vercel stack: includes root + env, sets `terraform { source }`, passes inputs |
| `terraform/modules/vercel-project/versions.tf` | `required_version`, `required_providers` for vercel |
| `terraform/modules/vercel-project/variables.tf` | All module inputs |
| `terraform/modules/vercel-project/main.tf` | `vercel_project`, `vercel_project_environment_variable` (for_each), `vercel_project_domain` (count) |
| `terraform/modules/vercel-project/outputs.tf` | `project_id`, `production_url` |

---

## Task 1: Project skeleton + `.gitignore`

**Files:**
- Create: `terraform/.gitignore`

- [ ] **Step 1: Create the terraform directory and .gitignore**

```bash
mkdir -p terraform/envs/prod/vercel
mkdir -p terraform/modules/vercel-project
```

Create `terraform/.gitignore`:

```gitignore
# Terraform
.terraform/
.terraform.lock.hcl
*.tfstate
*.tfstate.*
*.tfplan
crash.log

# Terragrunt
.terragrunt-cache/

# Variable files (values live in HCP Terraform)
*.tfvars
*.tfvars.json
!example.tfvars
```

- [ ] **Step 2: Commit the skeleton**

```bash
git add terraform/.gitignore
git commit -m "chore(terraform): add gitignore for terraform/terragrunt artifacts"
```

---

## Task 2: Pin Vercel provider version via context7

**Files:** none (research step)

- [ ] **Step 1: Look up the latest Vercel terraform provider version**

Use the context7 MCP tool to resolve the Vercel terraform provider's current major version and the `vercel_project_environment_variable` resource schema. The version pin in Task 3 must reference an actual published version (not a guess).

Run:

```
mcp__plugin_context7_context7__resolve-library-id with libraryName="vercel terraform provider"
mcp__plugin_context7_context7__query-docs with the resolved id and topic="vercel_project resource"
```

Expected: a current major version (e.g. `2.x`) and the up-to-date attribute names for `vercel_project.git_repository`, `vercel_project_environment_variable`, `vercel_project_domain`.

Record the pinned version (e.g. `~> 2.0`) for use in Task 3. If anything in this plan's example HCL conflicts with the actual schema (e.g. attribute names), fix in the corresponding task and note in the README.

---

## Task 3: vercel-project module — `versions.tf`

**Files:**
- Create: `terraform/modules/vercel-project/versions.tf`

- [ ] **Step 1: Write versions.tf**

```hcl
terraform {
  required_version = ">= 1.6"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 4.0" # confirmed via context7 (current major series 4.x, official docs show >= 4.8)
    }
  }
}
```

- [ ] **Step 2: Format and validate**

```bash
cd terraform/modules/vercel-project
terraform fmt
terraform init -backend=false
terraform validate
```

Expected: `Success! The configuration is valid.`

- [ ] **Step 3: Commit**

```bash
git add terraform/modules/vercel-project/versions.tf
git commit -m "feat(terraform): vercel-project module versions.tf"
```

---

## Task 4: vercel-project module — `variables.tf`

**Files:**
- Create: `terraform/modules/vercel-project/variables.tf`

- [ ] **Step 1: Write variables.tf**

```hcl
variable "project_name" {
  type        = string
  description = "Vercel project name. Must match the existing project name for import to succeed."
}

variable "framework" {
  type        = string
  default     = "nextjs"
  description = "Vercel framework preset."
}

variable "root_directory" {
  type        = string
  default     = "frontend"
  description = "Subdirectory in the repo where the deployable app lives."
}

variable "team_id" {
  type        = string
  default     = null
  description = "Vercel team ID. Null for personal Hobby accounts."
}

variable "github_repo" {
  type        = string
  description = "GitHub repo in 'owner/repo' format used for the Git integration."
}

variable "production_branch" {
  type        = string
  default     = "main"
  description = "Git branch that triggers production deployments."
}

variable "custom_domain" {
  type        = string
  default     = ""
  description = "Custom domain to bind to this project. Empty string skips the domain resource."
}

variable "env_vars" {
  type = map(object({
    value     = string
    target    = list(string)
    sensitive = optional(bool, false)
  }))
  default     = {}
  description = "Environment variables, keyed by variable name. target is a subset of [production, preview, development]."
}
```

- [ ] **Step 2: Format and validate**

```bash
cd terraform/modules/vercel-project
terraform fmt
terraform validate
```

Expected: `Success!`

- [ ] **Step 3: Commit**

```bash
git add terraform/modules/vercel-project/variables.tf
git commit -m "feat(terraform): vercel-project module variables"
```

---

## Task 5: vercel-project module — `main.tf`

**Files:**
- Create: `terraform/modules/vercel-project/main.tf`

- [ ] **Step 1: Write main.tf**

The exact attribute names below are based on Vercel provider v2.x. If Task 2 surfaced different names, adjust here before committing.

```hcl
resource "vercel_project" "this" {
  name      = var.project_name
  framework = var.framework
  team_id   = var.team_id

  root_directory   = var.root_directory
  build_command    = "npm run build"
  install_command  = "npm install"
  output_directory = ".next"

  git_repository = {
    type              = "github"
    repo              = var.github_repo
    production_branch = var.production_branch
  }
}

resource "vercel_project_environment_variable" "this" {
  for_each = var.env_vars

  project_id = vercel_project.this.id
  team_id    = var.team_id
  key        = each.key
  value      = each.value.value
  target     = each.value.target
  sensitive  = each.value.sensitive
}

resource "vercel_project_domain" "this" {
  count = var.custom_domain != "" ? 1 : 0

  project_id = vercel_project.this.id
  team_id    = var.team_id
  domain     = var.custom_domain
}
```

- [ ] **Step 2: Format and validate**

```bash
cd terraform/modules/vercel-project
terraform fmt
terraform validate
```

Expected: `Success!`. If `validate` complains about attribute names, fix per the actual provider schema (use the context7 docs from Task 2).

- [ ] **Step 3: Commit**

```bash
git add terraform/modules/vercel-project/main.tf
git commit -m "feat(terraform): vercel-project module main resources"
```

---

## Task 6: vercel-project module — `outputs.tf`

**Files:**
- Create: `terraform/modules/vercel-project/outputs.tf`

- [ ] **Step 1: Write outputs.tf**

```hcl
output "project_id" {
  value       = vercel_project.this.id
  description = "Vercel project ID. Future stacks (backend, monitoring) reference this."
}

output "production_url" {
  value       = "https://${vercel_project.this.name}.vercel.app"
  description = "Default vercel.app production URL. Custom domains are separate."
}
```

- [ ] **Step 2: Format and validate**

```bash
cd terraform/modules/vercel-project
terraform fmt
terraform validate
```

Expected: `Success!`

- [ ] **Step 3: Commit**

```bash
git add terraform/modules/vercel-project/outputs.tf
git commit -m "feat(terraform): vercel-project module outputs"
```

---

## Task 7: Root `terragrunt.hcl`

**Files:**
- Create: `terraform/terragrunt.hcl`

- [ ] **Step 1: Write the root terragrunt.hcl**

```hcl
# Root configuration for all stacks under terraform/.
# Owns the HCP Terraform remote backend and the Vercel provider declaration.

locals {
  env_vars     = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  organization = get_env("HCP_TF_ORGANIZATION")
  project_slug = "english-cafe"

  # Stack name is derived from path under envs/<env>/, e.g. "vercel".
  stack_name = replace(path_relative_to_include(), "/", "-")
}

remote_state {
  backend = "remote"

  generate = {
    path      = "backend.tf"
    if_exists = "overwrite"
  }

  config = {
    hostname     = "app.terraform.io"
    organization = local.organization

    workspaces = {
      name = "${local.project_slug}-${local.env_vars.locals.environment}-${local.stack_name}"
    }
  }
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "vercel" {
  api_token = var.vercel_api_token
  team      = var.vercel_team_id
}
EOF
}

generate "common_variables" {
  path      = "common_variables.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
variable "vercel_api_token" {
  type        = string
  sensitive   = true
  description = "Vercel API token. Set via HCP Terraform workspace variable."
}

variable "vercel_team_id" {
  type        = string
  default     = null
  description = "Vercel team ID. Null for personal Hobby accounts."
}
EOF
}
```

- [ ] **Step 2: Format**

```bash
cd terraform
terragrunt hclfmt
```

Expected: no errors. If `terragrunt` is not installed, install via `brew install terragrunt` or follow `terragrunt.gruntwork.io/docs/getting-started/install/`.

- [ ] **Step 3: Commit**

```bash
git add terraform/terragrunt.hcl
git commit -m "feat(terraform): root terragrunt config with HCP backend and vercel provider"
```

---

## Task 8: `envs/prod/env.hcl`

**Files:**
- Create: `terraform/envs/prod/env.hcl`

- [ ] **Step 1: Write env.hcl**

```hcl
locals {
  environment = "prod"

  tags = {
    Environment = "prod"
    Project     = "english-cafe"
    ManagedBy   = "terraform"
  }
}
```

- [ ] **Step 2: Format and commit**

```bash
cd terraform
terragrunt hclfmt
git add terraform/envs/prod/env.hcl
git commit -m "feat(terraform): prod environment hcl"
```

---

## Task 9: Vercel stack `terragrunt.hcl`

**Files:**
- Create: `terraform/envs/prod/vercel/terragrunt.hcl`

- [ ] **Step 1: Write the stack config**

```hcl
include "root" {
  path = find_in_parent_folders("terragrunt.hcl")
}

include "env" {
  path = find_in_parent_folders("env.hcl")
}

terraform {
  source = "${get_repo_root()}/terraform/modules/vercel-project"
}

# Inputs are committed in code (non-secret). Values for `env_vars`, secrets, and the
# HCP organization name live in HCP Terraform workspace variables — see terraform/README.md.
inputs = {
  project_name      = "english-cafe-frontend"
  github_repo       = "bzkz/english-caf" # update if owner/repo differs
  production_branch = "main"
  custom_domain     = "english-cafe.bz-kz.com"

  # env_vars is intentionally an empty default here. The actual env-var map is
  # injected via the HCP Terraform workspace variable `env_vars` (HCL/JSON typed),
  # which lets HCP keep the full value set under one sensitive variable.
  # See terraform/README.md "Environment variables" section for the JSON shape.
  env_vars = {}
}
```

- [ ] **Step 2: Format and commit**

```bash
cd terraform
terragrunt hclfmt
git add terraform/envs/prod/vercel/terragrunt.hcl
git commit -m "feat(terraform): vercel stack entry for prod"
```

---

## Task 10: README — setup, import workflow, troubleshooting

**Files:**
- Create: `terraform/README.md`

- [ ] **Step 1: Write the README**

```markdown
# Terraform — Vercel frontend (prod)

Manages the Vercel project, environment variables, and bound custom domain for the production frontend (`english-cafe-frontend` → `https://english-cafe.bz-kz.com`). State and secrets live in HCP Terraform (Terraform Cloud) free plan.

## Layout

\`\`\`
terraform/
├── terragrunt.hcl                 # root: remote backend + provider
├── envs/prod/
│   ├── env.hcl                    # prod locals
│   └── vercel/terragrunt.hcl      # this stack
└── modules/vercel-project/        # reusable module
\`\`\`

## Prerequisites

- Terraform `>= 1.6`
- Terragrunt `>= 0.55`
- An HCP Terraform organization. Create at https://app.terraform.io.

## One-time setup

1. Export your HCP Terraform org name:

   \`\`\`bash
   export HCP_TF_ORGANIZATION=<your-org>
   \`\`\`

2. Log in to HCP Terraform CLI:

   \`\`\`bash
   terraform login
   \`\`\`

3. From `terraform/envs/prod/vercel/`, run:

   \`\`\`bash
   terragrunt init
   \`\`\`

   This creates the workspace `english-cafe-prod-vercel` in your HCP organization.

4. In the HCP Terraform UI for that workspace, set the following **Terraform variables** (not environment variables):

   | Variable | Type | Sensitive | Notes |
   |---|---|---|---|
   | `vercel_api_token` | string | ✓ | https://vercel.com/account/tokens |
   | `vercel_team_id` | string | — | Leave unset/null for personal Hobby |
   | `env_vars` | HCL | ✓ | Full env-var map. See shape below. |

   `env_vars` HCL value example:

   \`\`\`hcl
   {
     NEXT_PUBLIC_SITE_URL = {
       value     = "https://english-cafe.bz-kz.com"
       target    = ["production", "preview", "development"]
       sensitive = false
     }
     NEXT_PUBLIC_API_URL = {
       value     = "https://api.example.com"
       target    = ["production", "preview", "development"]
       sensitive = false
     }
     NEXT_PUBLIC_NEW_RELIC_LICENSE_KEY = {
       value     = "..."
       target    = ["production"]
       sensitive = true
     }
     # ...
   }
   \`\`\`

   The entire `env_vars` HCP variable is marked sensitive. Individual `sensitive` flags inside the map still propagate to Vercel for per-variable masking in the Vercel UI.

## Importing the existing project

The live site must be imported before the first `terragrunt apply`, otherwise Terraform attempts to create a duplicate and fails.

### 1. Gather IDs

\`\`\`bash
# Project ID
vercel projects ls
# or use the Vercel REST API: GET /v9/projects?search=english-cafe-frontend

# Env var IDs (one per row in the output)
vercel env ls english-cafe-frontend
\`\`\`

### 2. Run the imports

From `terraform/envs/prod/vercel/`:

\`\`\`bash
PROJECT_ID=<from step 1>

# Project
terragrunt import 'vercel_project.this' "$PROJECT_ID"

# One per env var present in your env_vars map
terragrunt import 'vercel_project_environment_variable.this["NEXT_PUBLIC_SITE_URL"]' \
    "$PROJECT_ID/<ENV_VAR_ID>"
# ...repeat for every key in env_vars...

# Custom domain
terragrunt import 'vercel_project_domain.this[0]' \
    "$PROJECT_ID/english-cafe.bz-kz.com"
\`\`\`

### 3. Verify zero diff

\`\`\`bash
terragrunt plan
\`\`\`

Expected: `No changes. Your infrastructure matches the configuration.`

If diffs appear: **the running site is the source of truth at this stage.** Adjust the module inputs in `envs/prod/vercel/terragrunt.hcl` (or the HCP `env_vars` variable) until plan is clean. Do not apply.

## Daily workflow

\`\`\`bash
cd terraform/envs/prod/vercel

# Preview a change
terragrunt plan

# Apply (runs remotely in HCP)
terragrunt apply
\`\`\`

## Adding a new env var

1. Add the key to the HCP workspace `env_vars` variable map (paste-edit the HCL value).
2. `terragrunt plan` — verify exactly one create.
3. `terragrunt apply`.

No code change required for env-var additions/removals.

## DNS

`english-cafe.bz-kz.com` resolves via DNS records on `bz-kz.com`, managed outside this repo. This Terraform stack only owns the Vercel-side domain binding.

## Future stacks

Layout reserves `envs/prod/<stack>/` for future additions:

- `envs/prod/github/` — repo settings, branch protection
- `envs/prod/render/` — backend service

Each gets its own HCP workspace (auto-created on `terragrunt init`) and its own state. Cross-stack references use Terragrunt `dependency` blocks.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Error: project name already exists` on first apply | Import skipped | Run the import steps before applying |
| Plan shows env var drift after import | HCP `env_vars` map doesn't match Vercel's current values | Update the HCP variable to match what Vercel currently has |
| `Error: invalid organization` on init | `HCP_TF_ORGANIZATION` env var unset | Export it and re-run `terragrunt init` |
| Provider attribute errors at `validate` | Provider major version mismatch | Update `version` pin in `modules/vercel-project/versions.tf` and re-validate |

\`\`\`
```

- [ ] **Step 2: Commit**

```bash
git add terraform/README.md
git commit -m "docs(terraform): setup, import workflow, troubleshooting"
```

---

## Task 11: Final formatting and validation pass

**Files:** none (verification)

- [ ] **Step 1: Recursive fmt across everything**

```bash
cd terraform
terraform fmt -recursive
terragrunt hclfmt
git status --short
```

Expected: clean working tree, or only whitespace-fix diffs.

- [ ] **Step 2: Validate the module standalone**

```bash
cd terraform/modules/vercel-project
terraform init -backend=false
terraform validate
```

Expected: `Success!`

- [ ] **Step 3: Validate the stack (offline, no HCP credentials needed)**

```bash
cd terraform/envs/prod/vercel
terragrunt hclvalidate
```

Expected: no errors. (`terragrunt validate` proper would call `terraform validate` against the live module, which needs init against the remote backend; `hclvalidate` is the offline-safe check.)

- [ ] **Step 4: Commit any fmt-only changes**

```bash
git add -u
git diff --cached --stat
git commit -m "style(terraform): apply fmt -recursive and hclfmt" || echo "nothing to commit"
```

---

## Task 12: Sanity-check guidance for the operator

**Files:** none

- [ ] **Step 1: Confirm the implementation hand-off requirements**

This Terraform configuration **cannot apply itself** until the operator (the human user) does the following manual setup, captured in `terraform/README.md`:

1. Creates the HCP Terraform organization (or names an existing one)
2. Sets `HCP_TF_ORGANIZATION` env var locally
3. Runs `terragrunt init` to create the workspace
4. Enters `vercel_api_token`, `vercel_team_id`, and `env_vars` in the HCP workspace UI
5. Runs the import sequence
6. Verifies `terragrunt plan` shows no changes
7. Only then runs `terragrunt apply`

The implementing agent should:

- Verify the final file tree matches the **File map** at the top of this plan
- Print the README's "One-time setup" and "Importing the existing project" sections to the operator
- Stop. Do not run `terragrunt init` or any HCP-side operation — that's the operator's call once they have their HCP org ready.

---

## Self-review notes

- **Spec coverage:** Sections 3–12 of the spec are each implemented by exactly one task (file map → Task 1; module → Tasks 3–6; root config → Task 7; env → Task 8; stack → Task 9; import workflow + README → Task 10; testing → Task 11; hand-off → Task 12). The `env_vars` simplification (single HCP variable instead of per-var sensitive flags) is a deliberate trade-off documented in the README.
- **Placeholders:** none. Every code block is concrete.
- **Type consistency:** `vercel_project.this`, `vercel_project_environment_variable.this`, `vercel_project_domain.this` used consistently. `var.env_vars` shape matches between module variables.tf, stack terragrunt.hcl, and README example.
- **Open assumption:** GitHub repo `owner/repo` is set to `bzkz/english-caf` as a placeholder. The implementing operator must confirm the actual GitHub remote and update Task 9 before the first plan. This is called out in the README "One-time setup" implicitly via the import-and-verify gate but not explicitly — verify in plan execution.
