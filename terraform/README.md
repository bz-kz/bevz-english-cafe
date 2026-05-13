# Terraform — Vercel frontend (prod)

Manages the Vercel project, environment variables, and bound custom domain for the production frontend (`english-cafe-prod` → `https://english-cafe.bz-kz.com`). State and secrets live in HCP Terraform (Terraform Cloud) free plan.

## Layout

```
terraform/
├── root.hcl                       # root: HCP cloud backend + provider
├── envs/prod/
│   ├── env.hcl                    # prod locals (incl. hcp_organization)
│   └── vercel/terragrunt.hcl      # this stack
└── modules/vercel-project/        # reusable module
```

## Prerequisites

- Terraform `>= 1.6`
- Terragrunt `>= 1.0`
- An HCP Terraform organization. Create at https://app.terraform.io.

## One-time setup

1. Pin the HCP organization slug in `terraform/envs/prod/env.hcl`:

   ```hcl
   locals {
     hcp_organization = "<your-org>"
     # ...
   }
   ```

   (No shell env var needed. The org name is non-secret and pinned in code so all shells agree.)

2. Log in to HCP Terraform CLI:

   ```bash
   terraform login
   ```

3. From `terraform/envs/prod/vercel/`, run:

   ```bash
   terragrunt init
   ```

   This creates the workspace `english-cafe-prod-vercel` in your HCP organization.

4. In the HCP Terraform UI for that workspace, set the following **Terraform variables** (not Environment variables):

   | Variable | Type | Sensitive | Notes |
   |---|---|---|---|
   | `vercel_api_token` | string | ✓ | https://vercel.com/account/tokens |
   | `vercel_team_id` | string | — | Leave unset/null for personal Hobby |
   | `env_vars` | **HCL** | ✓ | Full env-var map. See shape below. |

   **Important:** flip the `HCL` toggle ON for `env_vars`. Without it, the value is treated as a plain string and ignored.

   Do NOT add `env_vars` to terragrunt `inputs` — terragrunt writes to `terragrunt.auto.tfvars.json` which has higher precedence than HCP's runtime `terraform.tfvars`, so an inputs-side empty map would silently override the workspace value.

   `env_vars` HCL value example:

   ```hcl
   {
     NEXT_PUBLIC_GA_MEASUREMENT_ID = {
       value     = ""
       target    = ["production"]
       sensitive = false
     }
     NEXT_PUBLIC_GOOGLE_VERIFICATION = {
       value     = ""
       target    = ["production"]
       sensitive = false
     }
     # ...
   }
   ```

   The entire `env_vars` HCP variable is marked sensitive. Individual `sensitive` flags inside the map still propagate to Vercel for per-variable masking in the Vercel UI.

## Importing the existing project

If a Vercel project already exists (manual setup), import it before the first `terragrunt apply`, otherwise Terraform tries to create a duplicate and fails.

### 1. Gather IDs

```bash
# Project ID — from the Vercel dashboard: Project → Settings → General → "Project ID"
# (CLI `vercel projects ls` only shows projects in the currently-scoped team)
```

### 2. Run the imports

`terraform import` runs **locally**, so it can't read sensitive HCP workspace variables. Pass the Vercel token inline:

```bash
cd terraform/envs/prod/vercel
PROJECT_ID=<from step 1>
TOKEN=<vercel api token>

terragrunt init

TF_VAR_vercel_api_token="$TOKEN" \
  terragrunt import 'vercel_project.this' "$PROJECT_ID"

TF_VAR_vercel_api_token="$TOKEN" \
  terragrunt import 'vercel_project_domain.this[0]' \
  "$PROJECT_ID/english-cafe.bz-kz.com"
```

Env-var resources do **not** need importing — they are created on first apply.

### 3. Verify zero diff

```bash
terragrunt plan
```

Expected: minimal in-place drift on `vercel_project` (build/install/output commands becoming explicit, `resource_config` filling in computed fields), plus the new env-var resources to add. Domain should show no diff.

If diffs are larger than expected: **the running site is the source of truth at this stage.** Adjust the module inputs in `envs/prod/vercel/terragrunt.hcl` (or the HCP `env_vars` variable) until plan is clean. Do not apply.

## Daily workflow

```bash
cd terraform/envs/prod/vercel

# Preview a change
terragrunt plan

# Apply (runs remotely in HCP — no local token needed; HCP injects it)
terragrunt apply
```

Local `terragrunt import` and any other locally-run command still need `TF_VAR_vercel_api_token` passed inline.

## Adding a new env var

1. Add the key to the HCP workspace `env_vars` variable map (paste-edit the HCL value).
2. `terragrunt plan` — verify exactly one create.
3. `terragrunt apply`.

No code change required for env-var additions/removals.

## GitHub integration

The Vercel project links to GitHub repo `bz-kz/bevz-english-cafe` (production branch `main`). For Vercel to accept this link, the Vercel GitHub App must be installed on the GitHub account that owns the repo, and the **Vercel team that owns the Vercel project** must have access to that installation.

If apply fails with `error linking git repo: ... you need to install the GitHub integration first`:

- Visit https://vercel.com/<team>/<project>/settings/git
- Disconnect any stale connection
- Click Connect → GitHub → run through the install flow, granting access to `bz-kz/bevz-english-cafe`

## DNS

`english-cafe.bz-kz.com` resolves via DNS records on `bz-kz.com`, managed outside this repo. This Terraform stack only owns the Vercel-side domain binding.

## Future stacks

Layout reserves `envs/prod/<stack>/` for future additions:

- `envs/prod/cloudrun/` — Python service on Google Cloud Run
- `envs/prod/github/` — repo settings, branch protection

Each gets its own HCP workspace (auto-created on `terragrunt init`, named `english-cafe-prod-<stack>`) and its own state. Cross-stack references use Terragrunt `dependency` blocks.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Error: project name already exists` on first apply | Import skipped | Run the import steps before applying |
| `Value for var.vercel_api_token unavailable` during import | HCP marks the variable sensitive; local commands can't read HCP secrets | Pass `TF_VAR_vercel_api_token=...` inline when running terragrunt locally |
| Plan shows env var drift after import | HCP `env_vars` map doesn't match Vercel's current values | Update the HCP variable to match what Vercel currently has |
| `Error: organization "<name>" not found` on init | `hcp_organization` slug in `env.hcl` is wrong | Check the slug at https://app.terraform.io/app/organizations and update `env.hcl` |
| `Error: linking git repo: bad_request` on apply | Vercel team can't see the GitHub repo | Install/configure the Vercel GitHub App for the right account; see GitHub integration above |
| `env_vars` value on HCP shows but plan creates nothing | `inputs = { env_vars = ... }` set in terragrunt | Remove it; terragrunt's `.auto.tfvars.json` overrides HCP's runtime tfvars |
| Provider attribute errors at `validate` | Provider major version mismatch | Update `version` pin in `modules/vercel-project/versions.tf` and re-validate |
