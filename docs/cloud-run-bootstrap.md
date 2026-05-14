# Cloud Run + Firestore bootstrap checklist

Step-by-step procedure to bring up the GCP-side infrastructure that the FastAPI backend runs on. Run **once** by a human with sufficient GCP IAM. After this, HCP Terraform handles re-applies via Workload Identity Federation (WIF), no SA JSON keys.

> **Historical narrative**: this doc was written during the live Render → Cloud Run + Firestore migration. Phase D removed the SQLAlchemy code path and the `REPOSITORY_BACKEND` env var. The Phase C "flip" step (step 9 below) and rollback references that mention `REPOSITORY_BACKEND=sqlalchemy` are historical only — they no longer apply. For a fresh setup, skip step 9; Firestore is the only backend.

## Prerequisites

- GCP project `english-cafe-496209` exists (already provisioned)
- gcloud CLI installed locally, authenticated as a human account
- The human account has these GCP IAM roles on the project (one-shot for the bootstrap apply only — HCP takes over after):
  - `roles/iam.workloadIdentityPoolAdmin`
  - `roles/iam.serviceAccountAdmin`
  - `roles/resourcemanager.projectIamAdmin`
- HCP Terraform org `example-org-e62762` exists; CLI login completed (`terraform login`)
- The following GCP APIs enabled on the project:
  - `iam.googleapis.com`
  - `iamcredentials.googleapis.com`
  - `sts.googleapis.com`
  - `firestore.googleapis.com`
  - `run.googleapis.com`
  - `artifactregistry.googleapis.com`
  - `cloudresourcemanager.googleapis.com`

  Enable in one shot:
  ```bash
  gcloud services enable \
    iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
    firestore.googleapis.com run.googleapis.com artifactregistry.googleapis.com \
    cloudresourcemanager.googleapis.com \
    --project english-cafe-496209
  ```

---

## Pre-bootstrap hygiene

Before anything else, audit `~/.zshrc` (or your shell rc) for stale variables that will silently override terragrunt inputs. Common culprits from prior GCP/Firebase projects:

```bash
grep -E 'TF_VAR_|GOOGLE_APPLICATION_CREDENTIALS' ~/.zshrc
```

Remove or comment out everything that points at the wrong project — especially `TF_VAR_gcp_project_id`, `TF_VAR_project_id`, `TF_VAR_firebase_project_id`, and `GOOGLE_APPLICATION_CREDENTIALS` if the path is stale. `TF_VAR_*` env vars override `terragrunt.hcl` inputs **and** any tfvars files when the terragrunt inputs don't end up generating a real `.auto.tfvars.json`, which has bitten us — plan will silently target the wrong project. Then `unset` them in the current shell or open a fresh terminal.

After `gcloud auth application-default login`:

```bash
gcloud auth application-default set-quota-project english-cafe-496209
```

ADC's quota_project is separate from `gcloud config set project`. If it points at a stale project where you don't have `serviceusage.services.use`, API calls 403 with confusing "API not enabled" errors against the wrong project.

## 1. Create three HCP Terraform workspaces

In the HCP Terraform UI (https://app.terraform.io/app/example-org-e62762/workspaces), create three workspaces with these exact names (the terragrunt config derives the name from the stack directory):

| Name | Workflow | Execution mode |
|---|---|---|
| `english-cafe-prod-wif` | CLI-driven | **Local** (see note) |
| `english-cafe-prod-firestore` | CLI-driven | Remote |
| `english-cafe-prod-cloudrun` | CLI-driven | Remote |

> **Why `wif` is Local, not Remote**: the wif stack creates the Workload Identity Pool itself, so it cannot use WIF dynamic credentials for its own first apply. HCP's Remote runners have no ADC. Setting wif workspace's execution mode to Local makes terragrunt invoke terraform on your laptop (which has gcloud ADC) while state still lives in HCP. After bootstrap, the wif workspace stays Local — re-applies are rare and operationally fine to run from a laptop.

---

## 2. Apply the WIF stack (bootstrap with human credentials)

The WIF stack creates the Workload Identity Pool and the runner SA. It cannot use WIF for its own first apply (chicken-and-egg), so this single apply uses the human's gcloud Application Default Credentials.

```bash
gcloud auth application-default login
gcloud config set project english-cafe-496209

cd terraform/envs/prod/wif
terragrunt init
terragrunt apply
```

Confirm `yes` when prompted. Expected creates:

- `google_iam_workload_identity_pool.hcp`
- `google_iam_workload_identity_pool_provider.hcp`
- `google_service_account.runner`
- `google_project_iam_member.runner_roles` (×7)
- `google_service_account_iam_member.wif_runner` (×3)

After apply, capture the outputs:

```bash
terragrunt output -raw provider_name
terragrunt output -raw runner_service_account_email
```

---

## 3. Configure HCP workspaces for dynamic credentials

On **both** `english-cafe-prod-firestore` and `english-cafe-prod-cloudrun` workspaces, add these as **Environment Variables** (NOT Terraform Variables):

| Key | Value | Sensitive |
|---|---|---|
| `TFC_GCP_PROVIDER_AUTH` | `true` | no |
| `TFC_GCP_WORKLOAD_PROVIDER_NAME` | `<provider_name output from step 2>` | no |
| `TFC_GCP_RUN_SERVICE_ACCOUNT_EMAIL` | `<runner_service_account_email output>` | no |
| `TFC_GCP_WORKLOAD_IDENTITY_AUDIENCE` | `hcp.workload.identity` | no |

> **Why the explicit audience var**: our WIF provider declares `allowed_audiences = ["hcp.workload.identity"]`. Without this env var, HCP sends the full provider resource path as the OIDC token audience and Google rejects it with `invalid_grant: The audience in ID Token [...] does not match the expected audience`. Setting this matches HCP's docs' recommended pattern.

After this, those two workspaces will obtain ephemeral GCP credentials at plan/apply time via HCP's dynamic-credentials flow — no SA key file involved.

---

## 4. Apply the Firestore stack

```bash
cd ../firestore
terragrunt init
terragrunt apply
```

Expected creates:
- `google_firestore_database.this` (location `asia-northeast1`, type `FIRESTORE_NATIVE`, `deletion_policy = "ABANDON"`)

Verify in the Firestore Console: a Native-mode database labeled `(default)` should appear in the project.

---

## 5. Apply the Cloud Run stack with a placeholder image

The `cloudrun` stack requires `image` input. For the bootstrap apply, point it at Google's public hello sample so the service comes up green before the real backend image exists.

On `english-cafe-prod-cloudrun`, add this Terraform Variable:

| Key | Value | HCL toggle | Sensitive |
|---|---|---|---|
| `image` | `us-docker.pkg.dev/cloudrun/container/hello` | off | no |

Then:

```bash
cd ../cloudrun
terragrunt init
terragrunt apply
```

Expected creates:
- `google_artifact_registry_repository.this` — Docker repo `english-cafe` in `asia-northeast1`
- `google_service_account.runtime` — Cloud Run runtime SA
- `google_project_iam_member.runtime_firestore` — `roles/datastore.user` on the runtime SA
- `google_cloud_run_v2_service.this` — service `english-cafe-api`
- `google_cloud_run_v2_service_iam_member.public` — `allUsers` invoker (see note)
- `google_cloud_run_domain_mapping.this[0]` — only if `custom_domain` is set (see step 6)

> **`allUsers` may be blocked by an org policy**: if the project inherits `constraints/iam.allowedPolicyMemberDomains` from the org, the `allUsers` binding errors with `One or more users named in the policy do not belong to a permitted customer`. Override at the project level (requires `roles/orgpolicy.policyAdmin`):
>
> ```bash
> gcloud services enable orgpolicy.googleapis.com --project=english-cafe-496209
> cat > /tmp/policy.yaml <<EOF
> name: projects/english-cafe-496209/policies/iam.allowedPolicyMemberDomains
> spec:
>   inheritFromParent: false
>   rules:
>   - allowAll: true
> EOF
> gcloud org-policies set-policy /tmp/policy.yaml
> ```
>
> Propagation can take up to ~1 minute. After that, the binding works on retry.

Capture outputs:

```bash
terragrunt output -raw service_url            # https://english-cafe-api-<hash>-an.a.run.app
terragrunt output -raw artifact_registry_url  # asia-northeast1-docker.pkg.dev/english-cafe-496209/english-cafe
terragrunt output -json custom_domain_dns_records
```

Test the placeholder service is up:

```bash
curl "$(terragrunt output -raw service_url)"
# → "Congratulations | Cloud Run"
```

---

## 6. Domain mapping (manual, not in terraform)

> **Why manual**: Cloud Run requires the API caller (the principal running `create domain-mapping`) to be a Google-verified owner of the domain. The HCP runner SA isn't, and delegating Site Verification API ownership to a service account is more bootstrap complexity than the set-and-forget resource is worth. We set `custom_domain = ""` in `terraform/envs/prod/cloudrun/terragrunt.hcl` to skip terraform's domain-mapping resource, then create the mapping manually with gcloud as the verified user.

Verify ownership first (one-time, in `kodaira@bz-kz.com` Google account):

```bash
# bz-kz.com should already be verified if you ever added it to Search Console
gcloud domains list-user-verified
# → bz-kz.com
```

If not listed, add the property at https://search.google.com/search-console and complete DNS TXT verification.

Then create the mapping:

```bash
gcloud beta run domain-mappings create \
  --domain=api.bz-kz.com \
  --service=english-cafe-api \
  --region=asia-northeast1 \
  --project=english-cafe-496209
```

Output lists the DNS record to add:

```
NAME  RECORD TYPE  CONTENTS
api   CNAME        ghs.googlehosted.com.
```

Add the CNAME at the DNS provider (ムームードメイン for bz-kz.com). Then:

```bash
# Confirm DNS propagation
dig +short CNAME api.bz-kz.com

# Watch the domain mapping status
gcloud beta run domain-mappings describe \
  --domain=api.bz-kz.com \
  --region=asia-northeast1 \
  --project=english-cafe-496209
```

Wait for `Ready: True` and `CertificateProvisioned: True`. Google-managed cert provisioning typically takes 15–30 min after DNS propagates; can stretch longer. The mapping polls automatically every ~5 min.

Confirm:
```bash
curl https://api.bz-kz.com/health
# → {"status":"healthy", ...}
```

---

## 7. Build & push the first backend image

```bash
cd backend

# Authenticate Docker against Artifact Registry (one-time)
gcloud auth configure-docker asia-northeast1-docker.pkg.dev

IMAGE="asia-northeast1-docker.pkg.dev/english-cafe-496209/english-cafe/api:$(git rev-parse --short HEAD)"

# Build for amd64 explicitly — Cloud Run runs amd64, your laptop is likely arm64.
docker buildx build --platform linux/amd64 -f Dockerfile.prod -t "$IMAGE" --push .
```

Verify the image lists:
```bash
gcloud artifacts docker images list \
  asia-northeast1-docker.pkg.dev/english-cafe-496209/english-cafe
```

---

## 8. Swap the placeholder image for the real one

The module's `lifecycle.ignore_changes` includes `template[0].containers[0].image`, so terraform won't push image updates. Use gcloud directly:

```bash
gcloud run services update english-cafe-api \
  --image=asia-northeast1-docker.pkg.dev/english-cafe-496209/english-cafe/api:$(git rev-parse --short HEAD) \
  --region=asia-northeast1 \
  --project=english-cafe-496209
```

Also bump the HCP workspace `image` Terraform variable to the same value so terraform's state agrees (no actual change applied because of ignore_changes — keeps drift detection clean).

Smoke test:
```bash
curl https://api.bz-kz.com/health
# → {"status":"healthy","message":"英会話カフェ API is running"}
```

If 404 or 502: check Cloud Run logs:
```bash
gcloud run services logs read english-cafe-api --region asia-northeast1 --limit 50
```

> **Container failed to start (gotcha)**: if the revision fails with `did not listen on PORT=8000`, the most likely cause in this repo is that the new revision is using SQLAlchemy as backend but Postgres isn't reachable from Cloud Run (we have no Postgres). Either flip `REPOSITORY_BACKEND` to `firestore` (Phase C step below) before the first deploy, or accept the failed revision and immediately roll forward.
>
> Other gotchas we've actually hit and fixed in the Dockerfile:
> - `pyproject.toml`'s `readme = "../README.md"` references a path outside the Docker build context → drop the `readme` field
> - `uv run` at runtime fails for the `useradd -r` system user (no home, can't create `~/.cache/uv`) → put `/app/.venv/bin` on PATH and call `uvicorn` directly

Smoke test:
```bash
curl https://api.bz-kz.com/health
# → {"status":"healthy"} (or whatever the FastAPI health endpoint returns)
```

If 404 or 502: check Cloud Run logs:
```bash
gcloud run services logs read english-cafe-api --region asia-northeast1 --limit 50
```

---

## 9. Phase C cutover — flip the repository backend

The backend is now serving, but still configured to use SQLAlchemy (Postgres is unreachable from Cloud Run anyway, so the contact endpoint would 500 if hit). Flip to Firestore:

On `english-cafe-prod-cloudrun`, update the `env_vars` Terraform Variable. (It's currently set in `terragrunt.hcl` as an input. If you want to keep the source-of-truth in code, edit the file and commit; if you want to override per-environment without a commit, add an `env_vars` HCL Terraform Variable on the workspace.)

Recommended: edit `terraform/envs/prod/cloudrun/terragrunt.hcl` so the input becomes:

```hcl
env_vars = {
  GCP_PROJECT_ID     = local.env.locals.gcp_project_id
  REPOSITORY_BACKEND = "firestore"
  ENVIRONMENT        = "production"
}
```

Commit, push, then `terragrunt apply`.

Submit a test contact via curl:

```bash
curl -X POST https://api.bz-kz.com/api/v1/contacts/ \
  -H 'Content-Type: application/json' \
  -d '{"name":"bootstrap test","email":"t@example.com","message":"hello firestore","lesson_type":"trial","preferred_contact":"email"}'
# → 201 Created
```

Open the Firestore Console for project `english-cafe-496209` → Data → collection `contacts`. The document should be there.

---

## 10. Phase C cutover — point the frontend at Cloud Run

On the **`english-cafe-prod-vercel`** HCP workspace, update the `env_vars` Terraform Variable (HCL) — add or update this entry:

```hcl
NEXT_PUBLIC_API_URL = {
  value     = "https://api.bz-kz.com"
  target    = ["production"]
  sensitive = false
}
```

Then:
```bash
cd terraform/envs/prod/vercel
terragrunt apply
```

> **`ENV_CONFLICT` gotcha**: if `NEXT_PUBLIC_API_URL` was previously set via the Vercel UI, terraform apply fails with `ENV_CONFLICT - A variable with the name NEXT_PUBLIC_API_URL already exists`. Either delete the existing variable in Vercel UI then re-apply, or import it into terraform state with the Vercel API token inline. The delete-then-recreate path is faster for one-off bootstrap.

`NEXT_PUBLIC_*` values are baked into the client bundle at **build** time, so the variable change only takes effect on the next Vercel build. Vercel does NOT automatically rebuild on env var changes — trigger a build either by pushing a commit to `main` or clicking Redeploy on the latest production deployment in the Vercel UI.

Vercel will redeploy production with the new env var. After deploy, the frontend `frontend/src/app/api/contact/route.ts` route handler (which falls back to `NEXT_PUBLIC_API_URL` if `BACKEND_URL` is unset) will forward submissions to `https://api.bz-kz.com`.

End-to-end:
1. Open `https://english-cafe.bz-kz.com/contact`
2. Submit a contact
3. Confirm 201 in browser devtools Network tab
4. Confirm the new doc in Firestore Console

---

## 11. After Phase C is verified stable

- ~~Render service can be deleted~~ — already removed; `render.yaml` is gone from the repo.
- ~~Phase D (SQLAlchemy / Alembic / Postgres dead-code removal)~~ — completed in commit `5913c50`. The SQLAlchemy compatibility shim no longer exists, so the rollback row for "Step 9" below is historical only.
- Set up CI/CD so backend changes auto-build images and update `image` on the Cloud Run service (not yet done — see "Phase E" / GitHub Actions WIF auto-deploy notes elsewhere).

---

## Rollback strategies

| Stage | If broken | Rollback |
|---|---|---|
| Steps 1-6 | DNS not propagating, cert pending | Wait, or re-create domain mapping. No prod impact. |
| Steps 7-8 | Image fails to start | Update `image` workspace var back to the hello sample. The service stays up. |
| Step 9 | Firestore write fails | **Historical**: before Phase D, you could flip `REPOSITORY_BACKEND` back to `"sqlalchemy"` — but Cloud Run never had Postgres reachability, so this was always cosmetic. Phase D removed the switch entirely. To recover today, debug the Firestore client / IAM directly. |
| Step 10 | Frontend can't reach api.bz-kz.com | Remove `NEXT_PUBLIC_API_URL` from Vercel workspace var, apply. Frontend falls back to its proxy `/api/*` → which still points at the old `process.env.BACKEND_URL` value on Vercel (if any). |

---

## Cross-stack references at a glance

```
wif stack
  ├── outputs: provider_name, runner_service_account_email, audience
  ↓
firestore stack         cloudrun stack
  (uses runner SA          (uses runner SA via WIF; reads firestore via mock_outputs dependency)
   via WIF)                ↓
                          Cloud Run runtime SA (different from runner SA)
                          ↓
                          roles/datastore.user → Firestore Native DB

vercel stack (already deployed)
  └── once Phase C step 10 applies, env_vars.NEXT_PUBLIC_API_URL → https://api.bz-kz.com
```
