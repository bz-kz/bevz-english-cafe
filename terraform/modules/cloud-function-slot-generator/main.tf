resource "google_project_service" "required" {
  for_each = toset([
    "cloudfunctions.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudscheduler.googleapis.com",
    "pubsub.googleapis.com",
    "eventarc.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "firestore.googleapis.com",
  ])
  project            = var.gcp_project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_pubsub_topic" "daily" {
  project    = var.gcp_project_id
  name       = "slot-generator-daily"
  depends_on = [google_project_service.required]
}

resource "google_service_account" "fn" {
  project      = var.gcp_project_id
  account_id   = var.function_service_account_id
  display_name = "Daily slot generator"
}

resource "google_project_iam_member" "fn_firestore" {
  project = var.gcp_project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.fn.email}"
}

# Eventarc trigger SA = compute default; needs run.invoker + eventarc.eventReceiver.
# Without these, Pub/Sub messages reach Eventarc but the trigger silently fails
# to invoke the function.
data "google_project" "current" {
  project_id = var.gcp_project_id
}

locals {
  compute_default_sa = "${data.google_project.current.number}-compute@developer.gserviceaccount.com"
}

resource "google_project_iam_member" "eventarc_run_invoker" {
  project = var.gcp_project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${local.compute_default_sa}"
}

resource "google_project_iam_member" "eventarc_event_receiver" {
  project = var.gcp_project_id
  role    = "roles/eventarc.eventReceiver"
  member  = "serviceAccount:${local.compute_default_sa}"
}

# Zip the source directory at module path. Content-addressed name means a new
# object is uploaded only when source actually changes.
data "archive_file" "source" {
  type        = "zip"
  source_dir  = "${path.module}/source"
  output_path = "${path.module}/.terraform-tmp/source.zip"
}

resource "google_storage_bucket" "source" {
  project                     = var.gcp_project_id
  name                        = "${var.gcp_project_id}-slot-generator-source"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = true
}

resource "google_storage_bucket_object" "source_zip" {
  name   = "source-${data.archive_file.source.output_md5}.zip"
  bucket = google_storage_bucket.source.name
  source = data.archive_file.source.output_path
}

resource "google_cloudfunctions2_function" "slot_generator" {
  project  = var.gcp_project_id
  location = var.region
  name     = "slot-generator"

  build_config {
    runtime     = "python312"
    entry_point = "generate_daily_slots"
    source {
      storage_source {
        bucket = google_storage_bucket.source.name
        object = google_storage_bucket_object.source_zip.name
      }
    }
  }

  service_config {
    max_instance_count    = 1
    min_instance_count    = 0
    available_memory      = "256M"
    timeout_seconds       = 120
    service_account_email = google_service_account.fn.email
    environment_variables = {
      TARGET_PROJECT_ID = var.gcp_project_id
    }
  }

  event_trigger {
    trigger_region = var.region
    event_type     = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic   = google_pubsub_topic.daily.id
    retry_policy   = "RETRY_POLICY_RETRY"
  }

  depends_on = [
    google_project_service.required,
    google_project_iam_member.fn_firestore,
    google_project_iam_member.eventarc_run_invoker,
    google_project_iam_member.eventarc_event_receiver,
  ]
}

resource "google_cloud_scheduler_job" "daily" {
  project   = var.gcp_project_id
  region    = var.region
  name      = "slot-generator-daily"
  schedule  = var.schedule_cron
  time_zone = var.schedule_timezone

  pubsub_target {
    topic_name = google_pubsub_topic.daily.id
    data       = base64encode("{}")
  }
}
