# Production Environment Variables

# Application Configuration
variable "application_name" {
  description = "Name of the application"
  type        = string
  default     = "english-cafe-prod"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-northeast-1"
}

# New Relic Configuration
variable "newrelic_account_id" {
  description = "New Relic account ID"
  type        = string
  sensitive   = true
}

variable "newrelic_api_key" {
  description = "New Relic API key"
  type        = string
  sensitive   = true
}

# Grafana Configuration
variable "grafana_url" {
  description = "Grafana instance URL"
  type        = string
}

variable "grafana_auth_token" {
  description = "Grafana authentication token"
  type        = string
  sensitive   = true
}

# Prometheus Configuration
variable "prometheus_url" {
  description = "Prometheus server URL"
  type        = string
}

variable "prometheus_username" {
  description = "Prometheus username"
  type        = string
  default     = ""
}

variable "prometheus_password" {
  description = "Prometheus password"
  type        = string
  sensitive   = true
  default     = ""
}

# Notification Configuration
variable "slack_webhook_url" {
  description = "Slack webhook URL for alerts"
  type        = string
  sensitive   = true
}

variable "admin_email" {
  description = "Admin email for notifications"
  type        = string
}

variable "pagerduty_integration_key" {
  description = "PagerDuty integration key"
  type        = string
  sensitive   = true
  default     = ""
}

# Runbook Configuration
variable "runbook_url" {
  description = "URL to runbook documentation"
  type        = string
  default     = "https://github.com/your-org/english-cafe/wiki/runbooks"
}

# AWS Monitoring Configuration
variable "enable_aws_monitoring" {
  description = "Enable AWS CloudWatch monitoring"
  type        = bool
  default     = true
}

variable "ec2_instance_id" {
  description = "EC2 instance ID to monitor"
  type        = string
  default     = ""
}

# Custom Metrics Configuration
variable "enable_custom_metrics" {
  description = "Enable custom metrics collection via Lambda"
  type        = bool
  default     = false
}

# Cost Management
variable "monthly_budget_limit" {
  description = "Monthly budget limit for monitoring costs (USD)"
  type        = number
  default     = 50
}

# Feature Flags
variable "enable_business_alerts" {
  description = "Enable business metric alerts"
  type        = bool
  default     = true
}

variable "enable_performance_alerts" {
  description = "Enable performance alerts"
  type        = bool
  default     = true
}

variable "enable_error_alerts" {
  description = "Enable error alerts"
  type        = bool
  default     = true
}

# Alert Thresholds (Production values)
variable "alert_thresholds" {
  description = "Alert thresholds for production environment"
  type = object({
    error_rate_critical    = number
    error_rate_warning     = number
    response_time_critical = number
    response_time_warning  = number
    memory_usage_critical  = number
    memory_usage_warning   = number
    lcp_critical          = number
    lcp_warning           = number
    fid_critical          = number
    fid_warning           = number
    cls_critical          = number
    cls_warning           = number
  })
  
  default = {
    error_rate_critical    = 2
    error_rate_warning     = 1
    response_time_critical = 2000
    response_time_warning  = 1500
    memory_usage_critical  = 80
    memory_usage_warning   = 70
    lcp_critical          = 2500
    lcp_warning           = 2000
    fid_critical          = 100
    fid_warning           = 75
    cls_critical          = 0.1
    cls_warning           = 0.05
  }
}

# Retention Configuration
variable "data_retention_days" {
  description = "Data retention period in days"
  type        = number
  default     = 90
}

variable "log_retention_days" {
  description = "Log retention period in days"
  type        = number
  default     = 30
}

# Backup Configuration
variable "enable_backup" {
  description = "Enable configuration backup"
  type        = bool
  default     = true
}

variable "backup_schedule" {
  description = "Backup schedule (cron expression)"
  type        = string
  default     = "0 2 * * *"  # Daily at 2 AM
}

# Security Configuration
variable "allowed_ip_ranges" {
  description = "Allowed IP ranges for monitoring access"
  type        = list(string)
  default     = ["0.0.0.0/0"]  # Restrict in production
}

variable "enable_encryption" {
  description = "Enable encryption for sensitive data"
  type        = bool
  default     = true
}

# Scaling Configuration
variable "auto_scaling_enabled" {
  description = "Enable auto-scaling based on metrics"
  type        = bool
  default     = false
}

variable "scale_up_threshold" {
  description = "Threshold for scaling up"
  type        = number
  default     = 80
}

variable "scale_down_threshold" {
  description = "Threshold for scaling down"
  type        = number
  default     = 30
}

# Integration Configuration
variable "enable_third_party_integrations" {
  description = "Enable third-party integrations"
  type        = bool
  default     = true
}

variable "datadog_api_key" {
  description = "Datadog API key (optional)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "splunk_token" {
  description = "Splunk HEC token (optional)"
  type        = string
  sensitive   = true
  default     = ""
}

# Vercel Configuration
variable "vercel_api_token" {
  description = "Vercel API token"
  type        = string
  sensitive   = true
}

variable "vercel_project_name" {
  description = "Vercel project name"
  type        = string
  default     = "english-cafe"
}

variable "custom_domain" {
  description = "Custom domain for the application"
  type        = string
  default     = ""
}

# Render Configuration
variable "render_service_name" {
  description = "Render service name"
  type        = string
  default     = "english-cafe-api"
}

# GitHub Configuration
variable "github_repository" {
  description = "GitHub repository (format: owner/repo)"
  type        = string
}

# New Relic License Key
variable "newrelic_license_key" {
  description = "New Relic license key for browser monitoring"
  type        = string
  sensitive   = true
}

# Grafana Additional Configuration
variable "grafana_prometheus_endpoint" {
  description = "Grafana Prometheus endpoint URL"
  type        = string
  default     = ""
}

variable "grafana_api_key" {
  description = "Grafana API key for frontend integration"
  type        = string
  sensitive   = true
  default     = ""
}

# Render Configuration (for backend)
variable "render_api_key" {
  description = "Render API key"
  type        = string
  sensitive   = true
}

# Email Configuration (for backend)
variable "smtp_host" {
  description = "SMTP host for email sending"
  type        = string
  default     = "smtp.gmail.com"
}

variable "smtp_port" {
  description = "SMTP port"
  type        = string
  default     = "587"
}

variable "smtp_username" {
  description = "SMTP username"
  type        = string
  sensitive   = true
}

variable "smtp_password" {
  description = "SMTP password"
  type        = string
  sensitive   = true
}

# Application Security
variable "app_secret_key" {
  description = "Application secret key for JWT and encryption"
  type        = string
  sensitive   = true
}