# Grafana Module Variables

variable "application_name" {
  description = "Name of the application being monitored"
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

variable "manage_organization" {
  description = "Whether to manage the Grafana organization"
  type        = bool
  default     = false
}

variable "organization_name" {
  description = "Name of the Grafana organization"
  type        = string
  default     = ""
}

variable "admin_email" {
  description = "Admin email for the organization"
  type        = string
  default     = ""
}

variable "admin_users" {
  description = "List of admin users"
  type        = list(string)
  default     = []
}

variable "editor_users" {
  description = "List of editor users"
  type        = list(string)
  default     = []
}

variable "viewer_users" {
  description = "List of viewer users"
  type        = list(string)
  default     = []
}

variable "prometheus_url" {
  description = "Prometheus server URL"
  type        = string
}

variable "prometheus_auth" {
  description = "Prometheus authentication configuration"
  type = object({
    enabled  = bool
    username = string
    password = string
  })
  
  default = {
    enabled  = false
    username = ""
    password = ""
  }
}

variable "newrelic_integration" {
  description = "New Relic integration configuration"
  type = object({
    enabled    = bool
    account_id = string
    api_key    = string
  })
  
  default = {
    enabled    = false
    account_id = ""
    api_key    = ""
  }
}

variable "alert_thresholds" {
  description = "Alert thresholds for various metrics"
  type = object({
    error_rate     = number
    response_time  = number
    memory_usage   = number
    lcp_threshold  = number
    fid_threshold  = number
    cls_threshold  = number
  })
  
  default = {
    error_rate    = 5
    response_time = 2000
    memory_usage  = 85
    lcp_threshold = 4000
    fid_threshold = 300
    cls_threshold = 0.25
  }
}

variable "notification_channels" {
  description = "Notification channels configuration"
  type = object({
    slack_webhook = string
    slack_channel = string
    email         = string
  })
  
  default = {
    slack_webhook = ""
    slack_channel = "#alerts"
    email         = ""
  }
}

variable "runbook_url" {
  description = "URL to runbook for alert conditions"
  type        = string
  default     = ""
}

variable "dashboard_refresh_interval" {
  description = "Default refresh interval for dashboards"
  type        = string
  default     = "30s"
}

variable "alert_evaluation_interval" {
  description = "Interval for alert rule evaluation"
  type        = number
  default     = 60
}

variable "data_retention_days" {
  description = "Data retention period in days"
  type        = number
  default     = 30
}

variable "enable_business_dashboards" {
  description = "Enable business metrics dashboards"
  type        = bool
  default     = true
}

variable "custom_dashboard_configs" {
  description = "Custom dashboard configurations"
  type = map(object({
    title       = string
    description = string
    tags        = list(string)
    folder      = string
  }))
  default = {}
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Grafana URL for dashboard links
variable "grafana_url" {
  description = "Grafana instance URL for generating dashboard links"
  type        = string
}