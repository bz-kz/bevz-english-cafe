# Grafana Module Outputs

output "organization_id" {
  description = "Grafana organization ID (if managed)"
  value       = length(grafana_organization.english_cafe) > 0 ? grafana_organization.english_cafe[0].id : null
}

output "folder_ids" {
  description = "Map of folder names to IDs"
  value = {
    monitoring = grafana_folder.monitoring.id
    business   = grafana_folder.business.id
  }
}

output "folder_uids" {
  description = "Map of folder names to UIDs"
  value = {
    monitoring = grafana_folder.monitoring.uid
    business   = grafana_folder.business.uid
  }
}

output "data_source_ids" {
  description = "Map of data source names to IDs"
  value = {
    prometheus = grafana_data_source.prometheus.id
    newrelic   = length(grafana_data_source.newrelic) > 0 ? grafana_data_source.newrelic[0].id : null
  }
}

output "data_source_uids" {
  description = "Map of data source names to UIDs"
  value = {
    prometheus = grafana_data_source.prometheus.uid
    newrelic   = length(grafana_data_source.newrelic) > 0 ? grafana_data_source.newrelic[0].uid : null
  }
}

output "dashboard_ids" {
  description = "Map of dashboard names to IDs"
  value = {
    performance_overview = grafana_dashboard.performance_overview.id
    business_metrics     = grafana_dashboard.business_metrics.id
  }
}

output "dashboard_urls" {
  description = "Map of dashboard names to URLs"
  value = {
    performance_overview = "${trimsuffix(var.grafana_url, "/")}/d/${grafana_dashboard.performance_overview.uid}"
    business_metrics     = "${trimsuffix(var.grafana_url, "/")}/d/${grafana_dashboard.business_metrics.uid}"
  }
}

output "alert_rule_group_ids" {
  description = "Map of alert rule group names to IDs"
  value = {
    performance_alerts = grafana_rule_group.performance_alerts.id
    web_vitals_alerts  = grafana_rule_group.web_vitals_alerts.id
  }
}

output "contact_point_ids" {
  description = "Map of contact point names to IDs"
  value = {
    slack = grafana_contact_point.slack.id
    email = length(grafana_contact_point.email) > 0 ? grafana_contact_point.email[0].id : null
  }
}

output "notification_policy_id" {
  description = "Default notification policy ID"
  value       = grafana_notification_policy.default.id
}