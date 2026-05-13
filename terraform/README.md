# Terraform — Vercel frontend (prod)

Manages the Vercel project, environment variables, and bound custom domain for the production frontend (`english-cafe-frontend` → `https://english-cafe.bz-kz.com`). State and secrets live in HCP Terraform (Terraform Cloud) free plan.

## Layout

```
terraform/
├── terragrunt.hcl                 # root: remote backend + provider
├── envs/prod/
│   ├── env.hcl                    # prod locals
│   └── vercel/terragrunt.hcl      # this stack
└── modules/vercel-project/        # reusable module
```

## Prerequisites

- Terraform `>= 1.6`
- Terragrunt `>= 0.55`
- An HCP Terraform organization. Create at https://app.terraform.io.

## One-time setup

1. Export your HCP Terraform org name:

   ```bash
   export HCP_TF_ORGANIZATION=<your-org>
   ```

2. Log in to HCP Terraform CLI:

   ```bash
   terraform login
   ```

3. From `terraform/envs/prod/vercel/`, run:

   ```bash
   terragrunt init
   ```

   This creates the workspace `english-cafe-prod-vercel` in your HCP organization.

4. In the HCP Terraform UI for that workspace, set the following **Terraform variables** (not environment variables):

   | Variable | Type | Sensitive | Notes |
   |---|---|---|---|
   | `vercel_api_token` | string | ✓ | https://vercel.com/account/tokens |
   | `vercel_team_id` | string | — | Leave unset/null for personal Hobby |
   | `env_vars` | HCL | ✓ | Full env-var map. See shape below. |

   `env_vars` HCL value example:

   ```hcl
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
     # ...other env vars
   }
   ```

   The entire `env_vars` HCP variable is marked sensitive. Individual `sensitive` flags inside the map still propagate to Vercel for per-variable masking in the Vercel UI.

## Importing the existing project

The live site must be imported before the first `terragrunt apply`, otherwise Terraform attempts to create a duplicate and fails.

### 1. Gather IDs

```bash
# Project ID
vercel projects ls
# or use the Vercel REST API: GET /v9/projects?search=english-cafe-frontend

# Env var IDs (one per row in the output)
vercel env ls english-cafe-frontend
```

### 2. Run the imports

From `terraform/envs/prod/vercel/`:

```bash
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
```

### 3. Verify zero diff

```bash
terragrunt plan
```

Expected: `No changes. Your infrastructure matches the configuration.`

If diffs appear: **the running site is the source of truth at this stage.** Adjust the module inputs in `envs/prod/vercel/terragrunt.hcl` (or the HCP `env_vars` variable) until plan is clean. Do not apply.

## Daily workflow

```bash
cd terraform/envs/prod/vercel

# Preview a change
terragrunt plan

# Apply (runs remotely in HCP)
terragrunt apply
```

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
