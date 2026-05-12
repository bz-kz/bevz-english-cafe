# New Relic Terraform Module
# 英会話カフェWebサイトのNew Relic監視設定

terraform {
  required_providers {
    newrelic = {
      source  = "newrelic/newrelic"
      version = "~> 3.25"
    }
  }
}

# Note: New Relic applications are automatically created when the agent reports data
# No need to explicitly create application resources

# Alert Policy - Performance
resource "newrelic_alert_policy" "performance" {
  name                = "${var.application_name}-performance"
  incident_preference = "PER_CONDITION_AND_TARGET"
}

# Alert Policy - Errors
resource "newrelic_alert_policy" "errors" {
  name                = "${var.application_name}-errors"
  incident_preference = "PER_CONDITION_AND_TARGET"
}

# Alert Policy - Business Metrics
resource "newrelic_alert_policy" "business" {
  name                = "${var.application_name}-business"
  incident_preference = "PER_CONDITION_AND_TARGET"
}

# Alert Condition - High Error Rate
resource "newrelic_nrql_alert_condition" "high_error_rate" {
  policy_id                    = newrelic_alert_policy.errors.id
  name                        = "High Error Rate"
  type                        = "static"
  enabled                     = true
  violation_time_limit_seconds = 3600
  
  nrql {
    query = "SELECT percentage(count(*), WHERE response.status >= 400) FROM Transaction WHERE appName = '${var.application_name}'"
  }
  
  critical {
    operator      = "above"
    threshold     = var.alert_thresholds.error_rate
    threshold_duration = 300
    threshold_occurrences = "all"
  }
  
  warning {
    operator      = "above"
    threshold     = var.alert_thresholds.error_rate / 2
    threshold_duration = 600
    threshold_occurrences = "all"
  }
}

# Alert Condition - Slow Response Time
resource "newrelic_nrql_alert_condition" "slow_response_time" {
  policy_id                    = newrelic_alert_policy.performance.id
  name                        = "Slow Response Time"
  type                        = "static"
  enabled                     = true
  violation_time_limit_seconds = 3600
  
  nrql {
    query = "SELECT average(duration) FROM Transaction WHERE appName = '${var.application_name}'"
  }
  
  critical {
    operator      = "above"
    threshold     = var.alert_thresholds.response_time
    threshold_duration = 300
    threshold_occurrences = "all"
  }
  
  warning {
    operator      = "above"
    threshold     = var.alert_thresholds.response_time * 0.8
    threshold_duration = 600
    threshold_occurrences = "all"
  }
}

# Alert Condition - High Memory Usage
resource "newrelic_nrql_alert_condition" "high_memory_usage" {
  policy_id                    = newrelic_alert_policy.performance.id
  name                        = "High Memory Usage"
  type                        = "static"
  enabled                     = true
  violation_time_limit_seconds = 3600
  
  nrql {
    query = "SELECT average(memoryUsedPercent) FROM SystemSample WHERE appName = '${var.application_name}'"
  }
  
  critical {
    operator      = "above"
    threshold     = var.alert_thresholds.memory_usage
    threshold_duration = 600
    threshold_occurrences = "all"
  }
}

# NRQL Alert Condition - Core Web Vitals
resource "newrelic_nrql_alert_condition" "poor_lcp" {
  policy_id                    = newrelic_alert_policy.performance.id
  type                        = "static"
  name                        = "Poor LCP (Largest Contentful Paint)"
  description                 = "Alert when LCP is poor"
  runbook_url                 = var.runbook_url
  enabled                     = true
  violation_time_limit_seconds = 2592000
  
  nrql {
    query = "SELECT percentile(largestContentfulPaint, 75) FROM PageViewTiming WHERE appName = '${var.application_name}'"
  }
  
  critical {
    operator              = "above"
    threshold             = 4000
    threshold_duration    = 300
    threshold_occurrences = "all"
  }
  
  warning {
    operator              = "above"
    threshold             = 2500
    threshold_duration    = 300
    threshold_occurrences = "all"
  }
}

# NRQL Alert Condition - High FID
resource "newrelic_nrql_alert_condition" "poor_fid" {
  policy_id                    = newrelic_alert_policy.performance.id
  type                        = "static"
  name                        = "Poor FID (First Input Delay)"
  description                 = "Alert when FID is poor"
  runbook_url                 = var.runbook_url
  enabled                     = true
  violation_time_limit_seconds = 2592000
  
  nrql {
    query = "SELECT percentile(firstInputDelay, 75) FROM PageViewTiming WHERE appName = '${var.application_name}'"
  }
  
  critical {
    operator              = "above"
    threshold             = 300
    threshold_duration    = 300
    threshold_occurrences = "all"
  }
  
  warning {
    operator              = "above"
    threshold             = 100
    threshold_duration    = 300
    threshold_occurrences = "all"
  }
}

# NRQL Alert Condition - High CLS
resource "newrelic_nrql_alert_condition" "poor_cls" {
  policy_id                    = newrelic_alert_policy.performance.id
  type                        = "static"
  name                        = "Poor CLS (Cumulative Layout Shift)"
  description                 = "Alert when CLS is poor"
  runbook_url                 = var.runbook_url
  enabled                     = true
  violation_time_limit_seconds = 2592000
  
  nrql {
    query = "SELECT percentile(cumulativeLayoutShift, 75) FROM PageViewTiming WHERE appName = '${var.application_name}'"
  }
  
  critical {
    operator              = "above"
    threshold             = 0.25
    threshold_duration    = 300
    threshold_occurrences = "all"
  }
  
  warning {
    operator              = "above"
    threshold             = 0.1
    threshold_duration    = 300
    threshold_occurrences = "all"
  }
}

# Business Metrics Alert - Low Lesson Inquiries
resource "newrelic_nrql_alert_condition" "low_lesson_inquiries" {
  count = var.environment == "prod" ? 1 : 0
  
  policy_id                    = newrelic_alert_policy.business.id
  type                        = "static"
  name                        = "Low Lesson Inquiries"
  description                 = "Alert when lesson inquiries are unusually low"
  runbook_url                 = var.runbook_url
  enabled                     = true
  violation_time_limit_seconds = 86400
  
  nrql {
    query = "SELECT count(*) FROM PageAction WHERE actionName = 'lesson_inquiry'"
  }
  
  critical {
    operator              = "below"
    threshold             = 1
    threshold_duration    = 3600
    threshold_occurrences = "all"
  }
}

# Notification Channel - Slack
# Note: Slack destinations cannot be created via Terraform, must be created manually in New Relic UI
# resource "newrelic_notification_destination" "slack" {
#   count = length(var.notification_channels.slack) > 0 ? 1 : 0
#   
#   name = "${var.application_name}-slack"
#   type = "SLACK"
#   
#   property {
#     key   = "url"
#     value = var.notification_channels.slack
#   }
# }

# Notification Channel - Email
resource "newrelic_notification_destination" "email" {
  count = length(var.notification_channels.email) > 0 ? 1 : 0
  
  name = "${var.application_name}-email"
  type = "EMAIL"
  
  property {
    key   = "email"
    value = var.notification_channels.email
  }
}

# Workflow - Performance Alerts
# Note: Workflows will be configured manually in New Relic UI due to notification destination limitations
# resource "newrelic_workflow" "performance_alerts" {
#   name                  = "${var.application_name}-performance-workflow"
#   muting_rules_handling = "NOTIFY_ALL_ISSUES"
#   
#   issues_filter {
#     name = "performance-filter"
#     type = "FILTER"
#     
#     predicate {
#       attribute = "labels.policyIds"
#       operator  = "EXACTLY_MATCHES"
#       values    = [newrelic_alert_policy.performance.id]
#     }
#   }
#   
#   destination {
#     channel_id = length(newrelic_notification_destination.email) > 0 ? newrelic_notification_destination.email[0].id : null
#   }
# }

# Workflow - Error Alerts
# Note: Workflows will be configured manually in New Relic UI due to notification destination limitations
# resource "newrelic_workflow" "error_alerts" {
#   name                  = "${var.application_name}-error-workflow"
#   muting_rules_handling = "NOTIFY_ALL_ISSUES"
#   
#   issues_filter {
#     name = "error-filter"
#     type = "FILTER"
#     
#     predicate {
#       attribute = "labels.policyIds"
#       operator  = "EXACTLY_MATCHES"
#       values    = [newrelic_alert_policy.errors.id]
#     }
#   }
#   
#   destination {
#     channel_id = length(newrelic_notification_destination.email) > 0 ? newrelic_notification_destination.email[0].id : null
#   }
# }

# Dashboard - Performance Overview
resource "newrelic_one_dashboard" "performance_overview" {
  name = "${var.application_name} - Performance Overview"
  
  page {
    name = "Performance Metrics"
    
    # Core Web Vitals
    widget_billboard {
      title  = "Core Web Vitals"
      row    = 1
      column = 1
      width  = 4
      height = 3
      
      nrql_query {
        query = "SELECT percentile(largestContentfulPaint, 75) as 'LCP (ms)', percentile(firstInputDelay, 75) as 'FID (ms)', percentile(cumulativeLayoutShift, 75) as 'CLS' FROM PageViewTiming WHERE appName = '${var.application_name}' SINCE 1 hour ago"
      }
    }
    
    # Page Load Time
    widget_line {
      title  = "Page Load Time"
      row    = 1
      column = 5
      width  = 4
      height = 3
      
      nrql_query {
        query = "SELECT average(duration) FROM PageView WHERE appName = '${var.application_name}' TIMESERIES"
      }
    }
    
    # Error Rate
    widget_line {
      title  = "Error Rate"
      row    = 1
      column = 9
      width  = 4
      height = 3
      
      nrql_query {
        query = "SELECT percentage(count(*), WHERE error IS true) FROM PageView WHERE appName = '${var.application_name}' TIMESERIES"
      }
    }
    
    # Top Pages
    widget_table {
      title  = "Top Pages by Traffic"
      row    = 4
      column = 1
      width  = 6
      height = 3
      
      nrql_query {
        query = "SELECT count(*) as 'Page Views' FROM PageView WHERE appName = '${var.application_name}' FACET pageUrl SINCE 1 hour ago LIMIT 10"
      }
    }
    
    # User Actions
    widget_table {
      title  = "User Actions"
      row    = 4
      column = 7
      width  = 6
      height = 3
      
      nrql_query {
        query = "SELECT count(*) as 'Actions' FROM PageAction WHERE appName = '${var.application_name}' FACET actionName SINCE 1 hour ago"
      }
    }
  }
  
  page {
    name = "Business Metrics"
    
    # Lesson Inquiries
    widget_line {
      title  = "Lesson Inquiries"
      row    = 1
      column = 1
      width  = 6
      height = 3
      
      nrql_query {
        query = "SELECT count(*) FROM PageAction WHERE actionName = 'lesson_inquiry' AND appName = '${var.application_name}' TIMESERIES"
      }
    }
    
    # Contact Form Submissions
    widget_line {
      title  = "Contact Form Submissions"
      row    = 1
      column = 7
      width  = 6
      height = 3
      
      nrql_query {
        query = "SELECT count(*) FROM PageAction WHERE actionName = 'contact_submission' AND appName = '${var.application_name}' TIMESERIES"
      }
    }
    
    # Video Plays
    widget_pie {
      title  = "Video Engagement"
      row    = 4
      column = 1
      width  = 6
      height = 3
      
      nrql_query {
        query = "SELECT count(*) FROM PageAction WHERE actionName = 'video_play' AND appName = '${var.application_name}' FACET video_title SINCE 1 day ago"
      }
    }
    
    # Page Conversion Funnel
    widget_funnel {
      title  = "Conversion Funnel"
      row    = 4
      column = 7
      width  = 6
      height = 3
      
      nrql_query {
        query = "SELECT funnel(session, WHERE pageUrl LIKE '%/' as 'Homepage', WHERE pageUrl LIKE '%/lessons%' as 'Lessons Page', WHERE actionName = 'lesson_inquiry' as 'Inquiry') FROM PageView, PageAction WHERE appName = '${var.application_name}' SINCE 1 day ago"
      }
    }
  }
}

# Workload - English Cafe Application
resource "newrelic_workload" "english_cafe" {
  name         = var.application_name
  account_id   = var.newrelic_account_id
  description  = "English Cafe Website Workload"
  
  entity_search_query {
    query = "name LIKE '${var.application_name}%'"
  }
  
  scope_account_ids = [var.newrelic_account_id]
}