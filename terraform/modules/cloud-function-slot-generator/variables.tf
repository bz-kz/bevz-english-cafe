variable "gcp_project_id" {
  type        = string
  description = "Target GCP project."
}

variable "region" {
  type        = string
  description = "Cloud Function region (e.g. asia-northeast1)."
}

variable "function_service_account_id" {
  type        = string
  description = "Short SA id (no @-suffix) for the function runtime."
  default     = "slot-generator"
}

variable "schedule_cron" {
  type        = string
  description = "Cron expression (Cloud Scheduler syntax) in tz var below."
  default     = "0 0 * * *"
}

variable "schedule_timezone" {
  type    = string
  default = "Asia/Tokyo"
}
