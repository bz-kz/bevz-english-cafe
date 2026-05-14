resource "google_artifact_registry_repository" "this" {
  project       = var.gcp_project_id
  location      = var.region
  repository_id = var.artifact_registry_repo_id
  description   = "Docker images for english-cafe backend"
  format        = "DOCKER"
}

resource "google_service_account" "runtime" {
  project      = var.gcp_project_id
  account_id   = "${var.service_name}-runtime"
  display_name = "${var.service_name} Cloud Run runtime SA"
}

resource "google_project_iam_member" "runtime_firestore" {
  project = var.gcp_project_id
  # roles/datastore.user is the canonical IAM role for Firestore Native mode.
  role   = "roles/datastore.user"
  member = "serviceAccount:${google_service_account.runtime.email}"
}

# Firebase Admin SDK uses this role to call verify_id_token on inbound
# requests. Without it the SDK fails with 403 PERMISSION_DENIED.
resource "google_project_iam_member" "runtime_firebase_auth_viewer" {
  project = var.gcp_project_id
  role    = "roles/firebaseauth.viewer"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_cloud_run_v2_service" "this" {
  project  = var.gcp_project_id
  location = var.region
  name     = var.service_name
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.runtime.email

    scaling {
      min_instance_count = var.min_instance_count
      max_instance_count = var.max_instance_count
    }

    containers {
      image = var.image

      ports {
        container_port = var.container_port
      }

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
      }

      dynamic "env" {
        for_each = var.env_vars
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.secret_env_vars
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value.secret
              version = env.value.version
            }
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      # Allow CD pipeline to update image independently of Terraform.
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.gcp_project_id
  location = google_cloud_run_v2_service.this.location
  name     = google_cloud_run_v2_service.this.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# google_cloud_run_domain_mapping is the v1 resource; no v2 equivalent exists in provider 6.x.
resource "google_cloud_run_domain_mapping" "this" {
  count    = var.custom_domain != "" ? 1 : 0
  project  = var.gcp_project_id
  location = var.region
  name     = var.custom_domain

  metadata {
    namespace = var.gcp_project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.this.name
  }
}
