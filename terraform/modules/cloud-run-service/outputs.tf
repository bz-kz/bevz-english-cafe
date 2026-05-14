output "service_url" {
  description = "HTTPS URL of the Cloud Run service."
  value       = google_cloud_run_v2_service.this.uri
}

output "service_account_email" {
  description = "Email of the runtime service account attached to the Cloud Run service."
  value       = google_service_account.runtime.email
}

output "artifact_registry_url" {
  description = "Base URL for pushing Docker images to the Artifact Registry repository."
  value       = "${var.region}-docker.pkg.dev/${var.gcp_project_id}/${google_artifact_registry_repository.this.repository_id}"
}

output "custom_domain_dns_records" {
  description = "DNS resource records to configure at the DNS provider for the custom domain. Empty if custom_domain is not set."
  value       = try(google_cloud_run_domain_mapping.this[0].status[0].resource_records, [])
}
