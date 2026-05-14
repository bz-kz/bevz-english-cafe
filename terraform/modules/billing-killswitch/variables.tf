variable "gcp_project_id" {
  type        = string
  description = "GCP project ID where the killswitch resources will be created."
}

variable "billing_account_id" {
  type        = string
  description = "GCP billing account ID (without the 'billingAccounts/' prefix), e.g. '015032-CC5A81-BFE7CA'."
}

variable "amount_jpy" {
  type        = number
  default     = 2000
  description = "Monthly budget cap in whole JPY. The killswitch fires when cost reaches this amount."
}

variable "notification_email" {
  type        = string
  description = "Email address that receives budget alert notifications at 50%/90%/100% thresholds."
}

variable "region" {
  type        = string
  default     = "asia-northeast1"
  description = "GCP region for the Cloud Function and supporting resources."
}

variable "function_service_account_id" {
  type        = string
  default     = "billing-killswitch"
  description = "Account ID (no @domain suffix) for the service account the function runs as."
}
