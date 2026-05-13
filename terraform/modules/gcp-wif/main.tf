resource "google_iam_workload_identity_pool" "hcp" {
  project                   = var.gcp_project_id
  workload_identity_pool_id = var.pool_id
  display_name              = "HCP Terraform"
  description               = "Trusts HCP Terraform dynamic credentials for this org"
}

resource "google_iam_workload_identity_pool_provider" "hcp" {
  project                            = var.gcp_project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.hcp.workload_identity_pool_id
  workload_identity_pool_provider_id = var.provider_id
  display_name                       = "HCP Terraform OIDC"

  oidc {
    issuer_uri        = "https://app.terraform.io"
    allowed_audiences = ["hcp.workload.identity"]
  }

  attribute_mapping = {
    "google.subject"                        = "assertion.sub"
    "attribute.terraform_organization_name" = "assertion.terraform_organization_name"
    "attribute.terraform_project_name"      = "assertion.terraform_project_name"
    "attribute.terraform_workspace_name"    = "assertion.terraform_workspace_name"
    "attribute.terraform_run_phase"         = "assertion.terraform_run_phase"
  }

  attribute_condition = "assertion.terraform_organization_name == \"${var.hcp_organization}\""
}

# Runner SA: HCP Terraform exchanges its OIDC token for a Google credential that
# impersonates this account. Set TFC_GCP_RUN_SERVICE_ACCOUNT_EMAIL on each GCP
# workspace to this SA's email (see `runner_service_account_email` output).
resource "google_service_account" "runner" {
  project      = var.gcp_project_id
  account_id   = var.runner_service_account_id
  display_name = "HCP Terraform dynamic credentials runner"
  description  = "Impersonated by HCP Terraform workspaces via Workload Identity Federation"
}

resource "google_project_iam_member" "runner_roles" {
  for_each = toset(var.runner_iam_roles)
  project  = var.gcp_project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.runner.email}"
}

# Grant the listed HCP workspaces permission to impersonate the runner SA.
# `principalSet://` matches the value of `attribute.terraform_workspace_name`
# from the OIDC token, scoped to this WIF pool.
resource "google_service_account_iam_member" "wif_runner" {
  for_each           = toset(var.allowed_workspaces)
  service_account_id = google_service_account.runner.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.hcp.name}/attribute.terraform_workspace_name/${each.value}"
}
