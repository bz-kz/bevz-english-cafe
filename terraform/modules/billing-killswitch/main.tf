# --- API enablement ---
# These APIs may already be enabled from earlier stacks but we declare them
# here so this stack is self-contained. `disable_on_destroy = false` so
# destroying the killswitch stack doesn't accidentally turn off APIs other
# resources rely on.
resource "google_project_service" "required" {
  for_each = toset([
    "billingbudgets.googleapis.com",
    "cloudbilling.googleapis.com",
    "cloudfunctions.googleapis.com",
    "cloudbuild.googleapis.com",
    "eventarc.googleapis.com",
    "run.googleapis.com",
    "pubsub.googleapis.com",
    "artifactregistry.googleapis.com",
  ])
  project            = var.gcp_project_id
  service            = each.value
  disable_on_destroy = false
}

# --- Pub/Sub topic that budget alerts publish to ---
resource "google_pubsub_topic" "budget_alerts" {
  project    = var.gcp_project_id
  name       = "billing-budget-alerts"
  depends_on = [google_project_service.required]
}

# --- Notification channel for email alerts at 50% / 90% ---
resource "google_monitoring_notification_channel" "email" {
  project      = var.gcp_project_id
  display_name = "Billing budget email alerts"
  type         = "email"
  labels = {
    email_address = var.notification_email
  }
}

# --- Budget itself ---
resource "google_billing_budget" "monthly_cap" {
  billing_account = var.billing_account_id
  display_name    = "Monthly cap ${var.amount_jpy} JPY — ${var.gcp_project_id}"

  budget_filter {
    projects = ["projects/${var.gcp_project_id}"]
  }

  amount {
    specified_amount {
      currency_code = "JPY"
      units         = tostring(var.amount_jpy)
    }
  }

  threshold_rules {
    threshold_percent = 0.5
    spend_basis       = "CURRENT_SPEND"
  }
  threshold_rules {
    threshold_percent = 0.9
    spend_basis       = "CURRENT_SPEND"
  }
  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "CURRENT_SPEND"
  }

  all_updates_rule {
    pubsub_topic                     = google_pubsub_topic.budget_alerts.id
    schema_version                   = "1.0"
    disable_default_iam_recipients   = false
    monitoring_notification_channels = [google_monitoring_notification_channel.email.id]
  }
}

# --- Service account the function runs as ---
resource "google_service_account" "killswitch" {
  project      = var.gcp_project_id
  account_id   = var.function_service_account_id
  display_name = "Billing killswitch function"
  description  = "Disables project billing when monthly budget threshold is crossed"
}

# Project-level: allow SA to disable billing on this project.
resource "google_project_iam_member" "killswitch_project_billing_manager" {
  project = var.gcp_project_id
  role    = "roles/billing.projectManager"
  member  = "serviceAccount:${google_service_account.killswitch.email}"
}

# Billing-account-level: needed so the SA can complete the "disable billing"
# call (which technically detaches the project from the billing account).
resource "google_billing_account_iam_member" "killswitch_billing_user" {
  billing_account_id = var.billing_account_id
  role               = "roles/billing.user"
  member             = "serviceAccount:${google_service_account.killswitch.email}"
}

# Project-level read access. Without this the SA's `get_project_billing_info`
# call returns PERMISSION_DENIED — `roles/billing.projectManager` only grants
# create/delete billing assignment, not project resourcemanager.projects.get.
# `roles/browser` is the minimal role that provides it.
resource "google_project_iam_member" "killswitch_project_browser" {
  project = var.gcp_project_id
  role    = "roles/browser"
  member  = "serviceAccount:${google_service_account.killswitch.email}"
}

# --- Eventarc trigger SA permissions ---
# Cloud Functions 2nd gen uses the compute default SA as the Eventarc trigger
# SA (when event_trigger.service_account_email is unset). That SA needs
# permission to invoke the underlying Cloud Run service AND to receive
# Eventarc events. Without these, Pub/Sub messages reach Eventarc but the
# trigger silently fails to invoke the function ("The IAM principal lacks
# {run.routes.invoke} permission" in the function's audit logs).
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

# --- Function source bundle ---
# Zip the source directory at module path. Stored on GCS, referenced by the function.
data "archive_file" "source" {
  type        = "zip"
  source_dir  = "${path.module}/source"
  output_path = "${path.module}/.terraform-tmp/source.zip"
}

resource "google_storage_bucket" "function_source" {
  project                     = var.gcp_project_id
  name                        = "${var.gcp_project_id}-killswitch-source"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = true # OK — bucket only holds function source zips
}

resource "google_storage_bucket_object" "source_zip" {
  name   = "source-${data.archive_file.source.output_md5}.zip"
  bucket = google_storage_bucket.function_source.name
  source = data.archive_file.source.output_path
}

# --- The function (2nd gen) ---
resource "google_cloudfunctions2_function" "killswitch" {
  project  = var.gcp_project_id
  location = var.region
  name     = "billing-killswitch"

  build_config {
    runtime     = "python312"
    entry_point = "handle_budget_alert"
    source {
      storage_source {
        bucket = google_storage_bucket.function_source.name
        object = google_storage_bucket_object.source_zip.name
      }
    }
  }

  service_config {
    max_instance_count    = 1
    min_instance_count    = 0
    available_memory      = "256M"
    timeout_seconds       = 60
    service_account_email = google_service_account.killswitch.email
    environment_variables = {
      TARGET_PROJECT_ID = var.gcp_project_id
    }
  }

  event_trigger {
    trigger_region = var.region
    event_type     = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic   = google_pubsub_topic.budget_alerts.id
    retry_policy   = "RETRY_POLICY_RETRY"
  }

  depends_on = [
    google_project_service.required,
    google_project_iam_member.killswitch_project_billing_manager,
    google_project_iam_member.killswitch_project_browser,
    google_billing_account_iam_member.killswitch_billing_user,
    google_project_iam_member.eventarc_run_invoker,
    google_project_iam_member.eventarc_event_receiver,
  ]
}
