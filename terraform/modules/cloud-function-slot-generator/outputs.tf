output "function_name" {
  value = google_cloudfunctions2_function.slot_generator.name
}

output "topic_name" {
  value = google_pubsub_topic.daily.name
}
