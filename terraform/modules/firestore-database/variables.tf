variable "gcp_project_id" {
  type        = string
  description = "GCP project ID where the Firestore database will be created."
}

variable "location_id" {
  type        = string
  default     = "asia-northeast1"
  description = "Firestore location. Firestore uses location_id (not region)."
}

variable "database_id" {
  type        = string
  default     = "(default)"
  description = "Firestore database ID. Only one (default) database is allowed per GCP project."
}
