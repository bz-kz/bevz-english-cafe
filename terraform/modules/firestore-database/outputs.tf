output "name" {
  description = "Full resource name of the Firestore database."
  value       = google_firestore_database.this.name
}

output "location_id" {
  description = "Location where the Firestore database is provisioned."
  value       = google_firestore_database.this.location_id
}
