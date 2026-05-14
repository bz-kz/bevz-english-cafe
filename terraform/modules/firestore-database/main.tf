resource "google_firestore_database" "this" {
  project                           = var.gcp_project_id
  name                              = var.database_id
  location_id                       = var.location_id
  type                              = "FIRESTORE_NATIVE"
  concurrency_mode                  = "OPTIMISTIC"
  app_engine_integration_mode       = "DISABLED"
  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_DISABLED"
  delete_protection_state           = "DELETE_PROTECTION_DISABLED"
  # ABANDON prevents terragrunt destroy from deleting the live database.
  deletion_policy = "ABANDON"
}
