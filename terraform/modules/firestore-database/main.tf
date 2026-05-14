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

# Composite indexes needed by the lesson booking 2a queries.
# Firestore requires composite indexes for any multi-field where + order_by.

resource "google_firestore_index" "lesson_slots_open_future" {
  project    = var.gcp_project_id
  database   = google_firestore_database.this.name
  collection = "lesson_slots"

  fields {
    field_path = "status"
    order      = "ASCENDING"
  }
  fields {
    field_path = "start_at"
    order      = "ASCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "ASCENDING"
  }
}

resource "google_firestore_index" "bookings_user_created" {
  project    = var.gcp_project_id
  database   = google_firestore_database.this.name
  collection = "bookings"

  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "DESCENDING"
  }
}

resource "google_firestore_index" "bookings_user_slot_status" {
  project    = var.gcp_project_id
  database   = google_firestore_database.this.name
  collection = "bookings"

  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "slot_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "status"
    order      = "ASCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "ASCENDING"
  }
}
