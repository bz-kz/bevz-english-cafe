# Grafana Terraform Module
# 英会話カフェWebサイトのGrafana監視設定

terraform {
  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = "~> 2.9"
    }
  }
}

# Grafana Organization (if managing organizations)
resource "grafana_organization" "english_cafe" {
  count = var.manage_organization ? 1 : 0
  
  name         = var.organization_name
  admin_user   = var.admin_email
  create_users = true
  
  admins  = var.admin_users
  editors = var.editor_users
  viewers = var.viewer_users
}

# Folder for organizing dashboards
resource "grafana_folder" "monitoring" {
  title = "English Cafe Monitoring"
}

resource "grafana_folder" "business" {
  title = "Business Metrics"
}

# Data Source - Prometheus (for custom metrics)
resource "grafana_data_source" "prometheus" {
  type = "prometheus"
  name = "Prometheus"
  url  = var.prometheus_url
  
  basic_auth_enabled  = var.prometheus_auth.enabled
  basic_auth_username = var.prometheus_auth.username
  
  json_data_encoded = jsonencode({
    httpMethod   = "POST"
    timeInterval = "30s"
  })
  
  secure_json_data_encoded = jsonencode({
    basicAuthPassword = var.prometheus_auth.password
  })
}

# Data Source - New Relic (if available)
resource "grafana_data_source" "newrelic" {
  count = var.newrelic_integration.enabled ? 1 : 0
  
  type = "newrelic-newrelic-datasource"
  name = "New Relic"
  url  = "https://api.newrelic.com"
  
  json_data_encoded = jsonencode({
    accountId = var.newrelic_integration.account_id
  })
  
  secure_json_data_encoded = jsonencode({
    apiKey = var.newrelic_integration.api_key
  })
}

# Dashboard - Performance Overview
resource "grafana_dashboard" "performance_overview" {
  config_json = jsonencode({
    title = "English Cafe - Performance Overview"
    tags  = ["english-cafe", "performance", var.environment]
    
    time = {
      from = "now-1h"
      to   = "now"
    }
    
    refresh = "30s"
    
    panels = [
      {
        id    = 1
        title = "Core Web Vitals"
        type  = "stat"
        
        gridPos = {
          h = 8
          w = 12
          x = 0
          y = 0
        }
        
        targets = [
          {
            expr         = "web_vitals_lcp{app=\"${var.application_name}\"}"
            legendFormat = "LCP (ms)"
            refId        = "A"
          },
          {
            expr         = "web_vitals_fid{app=\"${var.application_name}\"}"
            legendFormat = "FID (ms)"
            refId        = "B"
          },
          {
            expr         = "web_vitals_cls{app=\"${var.application_name}\"}"
            legendFormat = "CLS"
            refId        = "C"
          }
        ]
        
        fieldConfig = {
          defaults = {
            thresholds = {
              steps = [
                { color = "green", value = null },
                { color = "yellow", value = 2500 },
                { color = "red", value = 4000 }
              ]
            }
          }
        }
      },
      
      {
        id    = 2
        title = "Page Load Time"
        type  = "timeseries"
        
        gridPos = {
          h = 8
          w = 12
          x = 12
          y = 0
        }
        
        targets = [
          {
            expr         = "rate(page_load_time_sum{app=\"${var.application_name}\"}[5m]) / rate(page_load_time_count{app=\"${var.application_name}\"}[5m])"
            legendFormat = "Average Load Time"
            refId        = "A"
          }
        ]
      },
      
      {
        id    = 3
        title = "Error Rate"
        type  = "timeseries"
        
        gridPos = {
          h = 8
          w = 12
          x = 0
          y = 8
        }
        
        targets = [
          {
            expr         = "rate(errors_total{app=\"${var.application_name}\"}[5m])"
            legendFormat = "Errors per second"
            refId        = "A"
          }
        ]
        
        fieldConfig = {
          defaults = {
            thresholds = {
              steps = [
                { color = "green", value = null },
                { color = "yellow", value = 0.01 },
                { color = "red", value = 0.05 }
              ]
            }
          }
        }
      },
      
      {
        id    = 4
        title = "User Actions"
        type  = "timeseries"
        
        gridPos = {
          h = 8
          w = 12
          x = 12
          y = 8
        }
        
        targets = [
          {
            expr         = "rate(user_actions_total{app=\"${var.application_name}\"}[5m])"
            legendFormat = "{{action}}"
            refId        = "A"
          }
        ]
      }
    ]
  })
  
  folder = grafana_folder.monitoring.id
}

# Dashboard - Business Metrics
resource "grafana_dashboard" "business_metrics" {
  config_json = jsonencode({
    title = "English Cafe - Business Metrics"
    tags  = ["english-cafe", "business", var.environment]
    
    time = {
      from = "now-24h"
      to   = "now"
    }
    
    refresh = "5m"
    
    panels = [
      {
        id    = 1
        title = "Lesson Inquiries"
        type  = "stat"
        
        gridPos = {
          h = 8
          w = 6
          x = 0
          y = 0
        }
        
        targets = [
          {
            expr         = "increase(user_actions_total{app=\"${var.application_name}\",action=\"lesson_inquiry\"}[24h])"
            legendFormat = "Inquiries (24h)"
            refId        = "A"
          }
        ]
      },
      
      {
        id    = 2
        title = "Contact Form Submissions"
        type  = "stat"
        
        gridPos = {
          h = 8
          w = 6
          x = 6
          y = 0
        }
        
        targets = [
          {
            expr         = "increase(user_actions_total{app=\"${var.application_name}\",action=\"contact_submission\"}[24h])"
            legendFormat = "Submissions (24h)"
            refId        = "A"
          }
        ]
      },
      
      {
        id    = 3
        title = "Page Views"
        type  = "stat"
        
        gridPos = {
          h = 8
          w = 6
          x = 12
          y = 0
        }
        
        targets = [
          {
            expr         = "increase(user_actions_total{app=\"${var.application_name}\",action=\"page_view\"}[24h])"
            legendFormat = "Page Views (24h)"
            refId        = "A"
          }
        ]
      },
      
      {
        id    = 4
        title = "Video Plays"
        type  = "stat"
        
        gridPos = {
          h = 8
          w = 6
          x = 18
          y = 0
        }
        
        targets = [
          {
            expr         = "increase(user_actions_total{app=\"${var.application_name}\",action=\"video_play\"}[24h])"
            legendFormat = "Video Plays (24h)"
            refId        = "A"
          }
        ]
      },
      
      {
        id    = 5
        title = "Conversion Funnel"
        type  = "bargauge"
        
        gridPos = {
          h = 8
          w = 12
          x = 0
          y = 8
        }
        
        targets = [
          {
            expr         = "increase(user_actions_total{app=\"${var.application_name}\",action=\"page_view\",page=\"/\"}[24h])"
            legendFormat = "Homepage Views"
            refId        = "A"
          },
          {
            expr         = "increase(user_actions_total{app=\"${var.application_name}\",action=\"page_view\",page=\"/lessons\"}[24h])"
            legendFormat = "Lessons Page Views"
            refId        = "B"
          },
          {
            expr         = "increase(user_actions_total{app=\"${var.application_name}\",action=\"lesson_inquiry\"}[24h])"
            legendFormat = "Lesson Inquiries"
            refId        = "C"
          }
        ]
      },
      
      {
        id    = 6
        title = "Popular Pages"
        type  = "table"
        
        gridPos = {
          h = 8
          w = 12
          x = 12
          y = 8
        }
        
        targets = [
          {
            expr         = "topk(10, increase(user_actions_total{app=\"${var.application_name}\",action=\"page_view\"}[24h]))"
            legendFormat = "{{page}}"
            refId        = "A"
            format       = "table"
          }
        ]
      }
    ]
  })
  
  folder = grafana_folder.business.id
}

# Alert Rule - High Error Rate
resource "grafana_rule_group" "performance_alerts" {
  name             = "performance-alerts"
  folder_uid       = grafana_folder.monitoring.uid
  interval_seconds = 60
  
  rule {
    name      = "HighErrorRate"
    condition = "C"
    
    data {
      ref_id         = "A"
      datasource_uid = grafana_data_source.prometheus.uid
      
      relative_time_range {
        from = 300
        to   = 0
      }
      
      model = jsonencode({
        expr         = "rate(errors_total{app=\"${var.application_name}\"}[5m])"
        intervalMs   = 1000
        maxDataPoints = 43200
        refId        = "A"
      })
    }
    
    data {
      ref_id         = "B"
      datasource_uid = "__expr__"
      
      relative_time_range {
        from = 0
        to   = 0
      }
      
      model = jsonencode({
        expression = "A"
        reducer    = "last"
        refId      = "B"
        type       = "reduce"
      })
    }
    
    data {
      ref_id         = "C"
      datasource_uid = "__expr__"
      
      relative_time_range {
        from = 0
        to   = 0
      }
      
      model = jsonencode({
        expression = "B > ${var.alert_thresholds.error_rate / 100}"
        refId      = "C"
        type       = "threshold"
      })
    }
    
    no_data_state  = "NoData"
    exec_err_state = "Alerting"
    for            = "5m"
    
    annotations = {
      description = "Error rate is above ${var.alert_thresholds.error_rate}% for English Cafe application"
      runbook_url = var.runbook_url
      summary     = "High error rate detected"
    }
    
    labels = {
      severity = "critical"
      team     = "engineering"
    }
  }
}

# Alert Rule - Poor Core Web Vitals
resource "grafana_rule_group" "web_vitals_alerts" {
  name             = "web-vitals-alerts"
  folder_uid       = grafana_folder.monitoring.uid
  interval_seconds = 300
  
  rule {
    name      = "PoorLCP"
    condition = "C"
    
    data {
      ref_id         = "A"
      datasource_uid = grafana_data_source.prometheus.uid
      
      relative_time_range {
        from = 900
        to   = 0
      }
      
      model = jsonencode({
        expr         = "web_vitals_lcp{app=\"${var.application_name}\"}"
        intervalMs   = 1000
        maxDataPoints = 43200
        refId        = "A"
      })
    }
    
    data {
      ref_id         = "B"
      datasource_uid = "__expr__"
      
      relative_time_range {
        from = 0
        to   = 0
      }
      
      model = jsonencode({
        expression = "A"
        reducer    = "last"
        refId      = "B"
        type       = "reduce"
      })
    }
    
    data {
      ref_id         = "C"
      datasource_uid = "__expr__"
      
      relative_time_range {
        from = 0
        to   = 0
      }
      
      model = jsonencode({
        expression = "B > 4000"
        refId      = "C"
        type       = "threshold"
      })
    }
    
    no_data_state  = "NoData"
    exec_err_state = "Alerting"
    for            = "5m"
    
    annotations = {
      description = "LCP (Largest Contentful Paint) is above 4000ms"
      runbook_url = var.runbook_url
      summary     = "Poor LCP performance detected"
    }
    
    labels = {
      severity = "warning"
      team     = "engineering"
      metric   = "lcp"
    }
  }
}

# Notification Policy
resource "grafana_notification_policy" "default" {
  group_by      = ["alertname", "grafana_folder"]
  contact_point = grafana_contact_point.slack.name
  
  group_wait      = "10s"
  group_interval  = "5m"
  repeat_interval = "12h"
  
  policy {
    matcher {
      label = "severity"
      match = "="
      value = "critical"
    }
    
    contact_point   = grafana_contact_point.slack.name
    group_wait      = "10s"
    group_interval  = "5m"
    repeat_interval = "1h"
  }
}

# Contact Point - Slack
resource "grafana_contact_point" "slack" {
  name = "slack-alerts"
  
  slack {
    url   = var.notification_channels.slack_webhook
    title = "English Cafe Alert"
    text  = "{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}"
  }
}

# Contact Point - Email
resource "grafana_contact_point" "email" {
  count = length(var.notification_channels.email) > 0 ? 1 : 0
  
  name = "email-alerts"
  
  email {
    addresses = [var.notification_channels.email]
    subject   = "English Cafe Alert - {{ .GroupLabels.alertname }}"
    message   = "{{ range .Alerts }}{{ .Annotations.description }}{{ end }}"
  }
}