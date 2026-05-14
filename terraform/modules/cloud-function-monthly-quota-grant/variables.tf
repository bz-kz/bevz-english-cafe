variable "gcp_project_id" {
  type        = string
  description = "Target GCP project ID (e.g. english-cafe-496209)."
}

variable "gcp_project_number" {
  type        = string
  description = "Target GCP project number (e.g. 934069947997). Used to derive the compute default SA without an API call."
}

variable "region" {
  type        = string
  description = "Cloud Function region (e.g. asia-northeast1)."
}

variable "function_service_account_id" {
  type        = string
  description = "Short SA id (no @-suffix) for the function runtime."
  default     = "monthly-quota-grant"
}

variable "schedule_cron" {
  type        = string
  description = "Cron expression (Cloud Scheduler syntax) in tz var below."
  default     = "0 0 1 * *"
}

variable "schedule_timezone" {
  type    = string
  default = "Asia/Tokyo"
}
