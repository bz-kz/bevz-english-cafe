# Terraform — infrastructure (prod)

## Stack inventory

| Stack | HCP workspace | Purpose | Depends on |
|---|---|---|---|
| `terraform/envs/prod/vercel` | english-cafe-prod-vercel | Vercel project, env vars, custom domain | (none) |
| `terraform/envs/prod/wif` | english-cafe-prod-wif | GCP Workload Identity Pool for HCP→GCP auth | (none) |
| `terraform/envs/prod/firestore` | english-cafe-prod-firestore | Firestore Native DB in asia-northeast1 + composite indexes for lesson-booking queries | wif |
| `terraform/envs/prod/cloudrun` | english-cafe-prod-cloudrun | Cloud Run service + Artifact Registry + domain mapping | wif, firestore |
| `terraform/envs/prod/billing` | english-cafe-prod-billing | Monthly cost cap + killswitch (disables billing at threshold) | (none) |
| `terraform/envs/prod/monthly-quota` | english-cafe-prod-monthly-quota | Cloud Function (`cloud-function-monthly-quota-grant`) — cron `0 0 1 * *` JST, grants `monthly_quota` docs | wif, firestore |
| `terraform/envs/prod/scheduler-slots` | english-cafe-prod-scheduler-slots | Cloud Function (`cloud-function-slot-generator`) — cron `0 0 * * *` JST, generates `lesson_slots` | wif, firestore |

### Billing killswitch (one-time bootstrap)

The `billing` stack requires billing-account-level IAM (`roles/billing.user` on
the billing account) which the HCP runner SA doesn't have. Run locally with
your own credentials:

1. Create HCP workspace `english-cafe-prod-billing`, set **Execution Mode** to
   **Local**.
2. Grant the local user a few permissions that Cloud Functions 2nd gen and the
   billing-budget API need. These were one-shot fixes during the live bootstrap;
   re-running on a different machine or different user requires repeating them:
   ```bash
   gcloud auth application-default set-quota-project english-cafe-496209

   # Cloud Functions 2nd gen builds default to the compute-default SA. The
   # local user needs ActAs to launch the build.
   gcloud iam service-accounts add-iam-policy-binding \
     <project-number>-compute@developer.gserviceaccount.com \
     --member="user:<your-email>" \
     --role="roles/iam.serviceAccountUser" \
     --project=english-cafe-496209

   # The compute-default SA itself needs build + logging perms so the Cloud
   # Build job can actually run and write logs.
   gcloud projects add-iam-policy-binding english-cafe-496209 \
     --member="serviceAccount:<project-number>-compute@developer.gserviceaccount.com" \
     --role="roles/cloudbuild.builds.builder" --condition=None
   gcloud projects add-iam-policy-binding english-cafe-496209 \
     --member="serviceAccount:<project-number>-compute@developer.gserviceaccount.com" \
     --role="roles/logging.logWriter" --condition=None
   ```
3. From a shell with `gcloud auth application-default login` completed by a
   user who has `roles/billing.user` (or `roles/billing.admin`) on billing
   account `015032-CC5A81-BFE7CA`:
   ```bash
   cd terraform/envs/prod/billing
   terragrunt init
   GOOGLE_CLOUD_QUOTA_PROJECT=english-cafe-496209 terragrunt apply
   ```
   The `GOOGLE_CLOUD_QUOTA_PROJECT` env var is required because the
   billingbudgets API does not consume the resource's project as the quota
   project by default. ADC's `set-quota-project` alone is not enough — the
   API checks the env var.
4. After apply, the budget shows up at
   https://console.cloud.google.com/billing/<billing-account>/budgets — verify
   the displayed amount is ¥2000 with thresholds at 50/90/100%.
5. To test: temporarily edit the budget down to ¥1 (manually in console), wait
   a few minutes, watch for the Cloud Function to fire and billing to be
   disabled. Then re-enable billing manually and bump the budget back to ¥2000
   via `terragrunt apply`.

---

## Apply order (first-time GCP bootstrap)

The `wif` stack provisions both the Workload Identity Pool **and** the runner SA that the other two stacks impersonate via WIF — no manual SA creation is required.

1. **Create three HCP workspaces** manually: `english-cafe-prod-wif`, `english-cafe-prod-firestore`, `english-cafe-prod-cloudrun` (CLI-driven workflow, agent type: remote).
2. **`wif` stack first** — bootstrap with human credentials:
   ```bash
   gcloud auth application-default login   # one-time
   cd terraform/envs/prod/wif
   terragrunt init
   terragrunt apply
   ```
   The human needs `roles/iam.workloadIdentityPoolAdmin` + `roles/iam.serviceAccountAdmin` + `roles/resourcemanager.projectIamAdmin` on the GCP project for this single apply. Subsequent re-applies happen via HCP (the runner SA gets the same roles).

   After apply, grab two outputs and set them as **Environment variables** (not Terraform variables) on the firestore and cloudrun workspaces:

   | HCP env var | Value source |
   |---|---|
   | `TFC_GCP_PROVIDER_AUTH` | `true` (literal) |
   | `TFC_GCP_WORKLOAD_PROVIDER_NAME` | `provider_name` output |
   | `TFC_GCP_RUN_SERVICE_ACCOUNT_EMAIL` | `runner_service_account_email` output |

3. **`firestore` stack**: `terragrunt apply` from HCP. Creates the Firestore Native DB in `asia-northeast1` and the composite indexes required by the lesson-booking queries. The repo-root `firestore.indexes.json` additionally holds the `users` and `monthly_quota` composite indexes (the `monthly_quota` `user_id ASC, year_month ASC` index backs the monthly-quota cron's `.where("user_id"==).where("year_month"==)` query).
4. **`cloudrun` stack**: requires `image` workspace variable (Terraform variable, not env var). For initial bootstrap, set `TF_VAR_image=us-docker.pkg.dev/cloudrun/container/hello` so the service comes up green. Phase C replaces it with the real Artifact Registry URI after the first image push.
5. **`vercel` stack** (already exists): in Phase C, add `NEXT_PUBLIC_API_URL=https://api.bz-kz.com` to the `env_vars` workspace HCL map.
6. **DNS**: after cloudrun apply, the `custom_domain_dns_records` output lists the records to add for `api.bz-kz.com` at the DNS provider. Wait for propagation + Google-managed cert provisioning (up to ~15 min).

---

# Vercel frontend stack

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

`envs/prod/cloudrun/` is **active and deployed** (see the stack inventory above), not a future stack. Layout still reserves `envs/prod/<stack>/` for further additions:

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
| `Permission "iam.workloadIdentityPools.create" denied` | Applying wif stack without sufficient GCP IAM | The human running wif bootstrap needs `roles/iam.workloadIdentityPoolAdmin` on the GCP project |
| `Error 403: ... DataStore` | Runtime SA missing Firestore permission | Check the `google_project_iam_member.runtime_firestore` binding in cloud-run-service module wasn't destroyed |
| `Domain mapping in PENDING state` | DNS records not yet propagated | Verify with `dig api.bz-kz.com`; cert provisioning can take up to 15 minutes after DNS propagates |
| `Permission billing.budgets.create denied` on billing stack apply | Local user lacks `roles/billing.user` on the billing account | In the GCP Billing console, grant `roles/billing.user` to the user running the apply (or `roles/billing.admin` for full control) |
| `Permission denied: resource '...billingAccounts/...'` from Cloud Function logs | Function SA missing `roles/billing.user` on the billing account | Terraform should have created `google_billing_account_iam_member.killswitch_billing_user`. Re-apply the billing stack |
| Billing-disable does not take effect | API enablement still propagating, or `cloudbilling` API not enabled on project | Wait ~1 min and retry; verify `cloudbilling.googleapis.com` is enabled |
