variable "gcp_project_id" {
  type        = string
  description = "GCP project ID where the Workload Identity Pool will be created."
}

variable "hcp_organization" {
  type        = string
  description = "HCP Terraform organization slug, e.g. example-org-e62762."
}

variable "hcp_project" {
  type        = string
  default     = "default"
  description = "HCP Terraform project slug. Used in the attribute condition."
}

variable "pool_id" {
  type        = string
  default     = "hcp-terraform-pool"
  description = "Workload Identity Pool ID."
}

variable "provider_id" {
  type        = string
  default     = "hcp-terraform-provider"
  description = "Workload Identity Pool Provider ID."
}

variable "runner_service_account_id" {
  type        = string
  default     = "hcp-terraform-runner"
  description = "Account ID (no @domain) for the SA HCP Terraform impersonates via WIF."
}

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
  ]
  description = "Project-level IAM roles granted to the HCP runner SA. Union of what every stack needs to apply."
}

variable "allowed_workspaces" {
  type = list(string)
  default = [
    "english-cafe-prod-wif",
    "english-cafe-prod-firestore",
    "english-cafe-prod-cloudrun",
  ]
  description = "HCP workspace names allowed to impersonate the runner SA via WIF."
}
