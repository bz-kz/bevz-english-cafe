output "pool_id" {
  description = "Full resource name of the Workload Identity Pool (projects/.../locations/global/workloadIdentityPools/...)."
  value       = google_iam_workload_identity_pool.hcp.name
}

output "provider_name" {
  description = "Full resource name of the Workload Identity Pool Provider."
  value       = google_iam_workload_identity_pool_provider.hcp.name
}

output "audience" {
  description = "Audience string for HCP Terraform dynamic credentials (TFC_GCP_WORKLOAD_PROVIDER_NAME value)."
  value       = "//iam.googleapis.com/${google_iam_workload_identity_pool_provider.hcp.name}"
}

output "runner_service_account_email" {
  description = "Email of the SA that HCP Terraform impersonates via WIF (TFC_GCP_RUN_SERVICE_ACCOUNT_EMAIL value)."
  value       = google_service_account.runner.email
}
