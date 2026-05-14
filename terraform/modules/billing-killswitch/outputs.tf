output "budget_name" {
  description = "Full resource name of the billing budget."
  value       = google_billing_budget.monthly_cap.name
}

output "topic_name" {
  description = "Name of the Pub/Sub topic that receives budget alert messages."
  value       = google_pubsub_topic.budget_alerts.name
}

output "function_name" {
  description = "Name of the Cloud Function (2nd gen) killswitch."
  value       = google_cloudfunctions2_function.killswitch.name
}

output "service_account_email" {
  description = "Email of the service account the killswitch function runs as."
  value       = google_service_account.killswitch.email
}
