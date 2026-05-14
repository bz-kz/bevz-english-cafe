output "function_name" {
  value = google_cloudfunctions2_function.monthly_quota_grant.name
}

output "topic_name" {
  value = google_pubsub_topic.monthly.name
}
