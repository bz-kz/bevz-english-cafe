# New Relic Module Variables

variable "application_name" {
  description = "Name of the New Relic application"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "newrelic_account_id" {
  description = "New Relic account ID"
  type        = string
}

variable "apdex_threshold" {
  description = "Apdex threshold for application performance"
  type        = number
  default     = 0.5
}

variable "end_user_apdex_threshold" {
  description = "End user Apdex threshold"
  type        = number
  default     = 7
}

variable "alert_thresholds" {
  description = "Alert thresholds for various metrics"
  type = object({
    error_rate     = number
    response_time  = number
    memory_usage   = number
  })
  
  default = {
    error_rate    = 5
    response_time = 2000
    memory_usage  = 85
  }
}

variable "notification_channels" {
  description = "Notification channels for alerts"
  type = object({
    slack = string
    email = string
  })
  
  default = {
    slack = ""
    email = ""
  }
}

variable "runbook_url" {
  description = "URL to runbook for alert conditions"
  type        = string
  default     = ""
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "enable_business_alerts" {
  description = "Enable business metric alerts (typically for production only)"
  type        = bool
  default     = false
}

variable "alert_evaluation_delay" {
  description = "Delay in seconds before evaluating alert conditions"
  type        = number
  default     = 120
}

variable "custom_attributes" {
  description = "Custom attributes to add to the application"
  type        = map(string)
  default     = {}
}