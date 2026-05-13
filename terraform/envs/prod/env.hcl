locals {
  environment = "prod"

  # HCP Terraform organization slug. Non-secret; pinned here so the value is
  # consistent across shells (env-var-based resolution caused drift when the
  # parent shell cached a stale value).
  hcp_organization = "example-org-e62762"

  # GCP target project for Cloud Run, Firestore, and Workload Identity stacks.
  gcp_project_id = "english-cafe-496209"

  # GCP region shared across GCP stacks.
  region = "asia-northeast1"

  tags = {
    Environment = "prod"
    Project     = "english-cafe"
    ManagedBy   = "terraform"
  }
}
