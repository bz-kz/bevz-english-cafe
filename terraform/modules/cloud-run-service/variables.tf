variable "gcp_project_id" {
  type        = string
  description = "GCP project ID where the Cloud Run service will be deployed."
}

variable "region" {
  type        = string
  default     = "asia-northeast1"
  description = "GCP region for the Cloud Run service and Artifact Registry."
}

variable "service_name" {
  type        = string
  default     = "english-cafe-api"
  description = "Cloud Run service name."
}

variable "image" {
  type        = string
  description = "Full Artifact Registry image URI, e.g. asia-northeast1-docker.pkg.dev/project/repo/image:tag."
}

variable "env_vars" {
  type        = map(string)
  default     = {}
  description = "Non-secret environment variables injected into the container."
}

variable "secret_env_vars" {
  type = map(object({
    secret  = string
    version = string
  }))
  default     = {}
  description = "Secret Manager secret references injected as env vars. Key is the env var name."
}

variable "custom_domain" {
  type        = string
  default     = ""
  description = "Custom domain to map to the Cloud Run service. Empty string skips domain mapping."
}

variable "artifact_registry_repo_id" {
  type        = string
  default     = "english-cafe"
  description = "Artifact Registry repository ID for Docker images."
}

variable "min_instance_count" {
  type        = number
  default     = 0
  description = "Minimum number of Cloud Run instances. 0 = scale to zero."
}

variable "max_instance_count" {
  type        = number
  default     = 3
  description = "Maximum number of Cloud Run instances."
}

variable "cpu" {
  type        = string
  default     = "1"
  description = "CPU allocation per container instance."
}

variable "memory" {
  type        = string
  default     = "512Mi"
  description = "Memory allocation per container instance."
}

variable "container_port" {
  type        = number
  default     = 8000
  description = "Port the container listens on."
}
