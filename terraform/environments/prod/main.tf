# Production Environment - Main Configuration
# 英会話カフェWebサイト本番環境の監視設定 (Vercel + Render)

terraform {
  required_version = ">= 1.6"
  
  required_providers {
    newrelic = {
      source  = "newrelic/newrelic"
      version = "~> 3.25"
    }
    # grafana = {
    #   source  = "grafana/grafana"
    #   version = "~> 2.9"
    # }
    vercel = {
      source  = "vercel/vercel"
      version = "~> 0.15"
    }
  }
  
  # Terraform Cloud backend (無料プラン)
  # 初回テスト時はコメントアウト、本格運用時は有効化
  # backend "remote" {
  #   organization = "english-cafe"
  #   
  #   workspaces {
  #     name = "monitoring-prod"
  #   }
  # }
}

# Provider Configuration
provider "newrelic" {
  account_id = var.newrelic_account_id
  api_key    = var.newrelic_api_key
  region     = "US"
}

# Grafana provider - Temporarily disabled due to API key permissions
# provider "grafana" {
#   url  = var.grafana_url
#   auth = var.grafana_auth_token
# }

provider "vercel" {
  api_token = var.vercel_api_token
}

# Local Values
locals {
  environment = "prod"
  
  common_tags = {
    Environment   = local.environment
    Project      = "english-cafe"
    ManagedBy    = "terraform"
    Owner        = "engineering-team"
    Platform     = "vercel-render"
    Application  = var.application_name
  }
  
  # Production-specific alert thresholds (stricter)
  alert_thresholds = {
    error_rate     = 2    # 2% error rate
    response_time  = 2000 # 2 seconds
    memory_usage   = 80   # 80% memory usage
    lcp_threshold  = 2500 # 2.5 seconds LCP
    fid_threshold  = 100  # 100ms FID
    cls_threshold  = 0.1  # 0.1 CLS
  }
  
  # Production notification channels
  notification_channels = {
    slack_webhook = var.slack_webhook_url
    slack_channel = "#prod-alerts"
    email         = var.admin_email
  }
  
  # Vercel + Render configuration
  deployment_config = {
    frontend_url = "https://${var.vercel_project_name}.vercel.app"
    backend_url  = "https://${var.render_service_name}.onrender.com"
  }
}

# Vercel Project Configuration
resource "vercel_project" "english_cafe_frontend" {
  name      = var.vercel_project_name
  framework = "nextjs"
  
  git_repository = {
    type = "github"
    repo = var.github_repository
  }
  
  environment = [
    {
      key    = "NEXT_PUBLIC_NEW_RELIC_LICENSE_KEY"
      value  = var.newrelic_license_key
      target = ["production"]
    },
    {
      key    = "NEXT_PUBLIC_NEW_RELIC_APP_NAME"
      value  = module.newrelic.application_name
      target = ["production"]
    },
    {
      key    = "NEXT_PUBLIC_GRAFANA_ENDPOINT"
      value  = var.grafana_prometheus_endpoint
      target = ["production"]
    },
    {
      key    = "NEXT_PUBLIC_GRAFANA_API_KEY"
      value  = var.grafana_api_key
      target = ["production"]
    },
    {
      key    = "NEXT_PUBLIC_API_URL"
      value  = local.deployment_config.backend_url
      target = ["production"]
    },
    {
      key    = "NEXT_PUBLIC_VERCEL_ANALYTICS"
      value  = "true"
      target = ["production"]
    }
  ]
}

# Vercel Domain Configuration
resource "vercel_project_domain" "english_cafe_domain" {
  count = var.custom_domain != "" ? 1 : 0
  
  project_id = vercel_project.english_cafe_frontend.id
  domain     = var.custom_domain
}

# New Relic Module
module "newrelic" {
  source = "../../modules/newrelic"
  
  application_name    = var.application_name
  environment        = local.environment
  newrelic_account_id = var.newrelic_account_id
  
  apdex_threshold          = 0.7  # Stricter for production
  end_user_apdex_threshold = 5    # Stricter for production
  
  alert_thresholds = local.alert_thresholds
  
  notification_channels = {
    slack = var.slack_webhook_url
    email = var.admin_email
  }
  
  runbook_url = var.runbook_url
  common_tags = local.common_tags
  
  enable_business_alerts = true
}

# Grafana Module - Temporarily disabled due to API key permissions
# module "grafana" {
#   source = "../../modules/grafana"
#   
#   application_name = var.application_name
#   environment     = local.environment
#   grafana_url     = var.grafana_url
#   
#   prometheus_url = var.prometheus_url
#   prometheus_auth = {
#     enabled  = true
#     username = var.prometheus_username
#     password = var.prometheus_password
#   }
#   
#   newrelic_integration = {
#     enabled    = true
#     account_id = var.newrelic_account_id
#     api_key    = var.newrelic_api_key
#   }
#   
#   alert_thresholds      = local.alert_thresholds
#   notification_channels = local.notification_channels
#   runbook_url          = var.runbook_url
#   
#   enable_business_dashboards = true
#   
#   common_tags = local.common_tags
# }

# Render Service Monitoring (via New Relic)
# Renderサービスは直接Terraformで管理しないが、監視設定を含める

# Health Check Configuration for Render Service
locals {
  render_health_checks = [
    {
      name = "Backend Health Check"
      url  = "${local.deployment_config.backend_url}/health"
      expected_status = 200
    },
    {
      name = "API Endpoint Check"
      url  = "${local.deployment_config.backend_url}/api/health"
      expected_status = 200
    }
  ]
}

# Synthetic Monitoring for Render Backend
# Note: Disabled due to API key issues, can be enabled once proper credentials are configured
# resource "newrelic_synthetics_monitor" "render_backend_health" {
#   count = length(local.render_health_checks)
#   
#   name   = local.render_health_checks[count.index].name
#   type   = "SIMPLE"
#   period = "EVERY_5_MINUTES"
#   status = "ENABLED"
#   
#   uri                       = local.render_health_checks[count.index].url
#   validation_string         = ""
#   verify_ssl                = true
#   bypass_head_request       = false
#   treat_redirect_as_failure = false
#   
#   locations_public = ["AWS_AP_NORTHEAST_1", "AWS_US_EAST_1"]
#   
#   tag {
#     key    = "Environment"
#     values = [local.environment]
#   }
#   
#   tag {
#     key    = "Service"
#     values = ["render-backend"]
#   }
# }

# Vercel Analytics Integration
# Vercel Analyticsは自動で有効化されるため、追加設定は不要

# Render Module (Custom API-based)
module "render" {
  source = "../../modules/render"
  
  render_api_key = var.render_api_key
  service_name   = var.render_service_name
  github_repo    = "https://github.com/${var.github_repository}"
  branch         = "main"
  
  build_command = "cd backend && pip install -e ."
  start_command = "cd backend && python -m app.main"
  
  environment   = "free"  # free, starter, standard, pro
  instance_type = "free"
  region        = "oregon"
  
  environment_variables = {
    # New Relic
    NEW_RELIC_LICENSE_KEY = var.newrelic_license_key
    NEW_RELIC_APP_NAME    = var.application_name
    
    # CORS
    FRONTEND_URL = local.deployment_config.frontend_url
    
    # Email
    SMTP_HOST     = var.smtp_host
    SMTP_PORT     = var.smtp_port
    SMTP_USERNAME = var.smtp_username
    SMTP_PASSWORD = var.smtp_password
    
    # Security
    SECRET_KEY = var.app_secret_key
    
    # Environment
    ENVIRONMENT = local.environment
  }
  
  create_database = true
  database_name   = "${var.application_name}-db"
  database_plan   = "free"
  
  auto_deploy        = true
  health_check_path  = "/health"
  
  common_tags = local.common_tags
}

# Cost Monitoring (無料サービスのため最小限)
locals {
  cost_summary = {
    vercel = "Free (Hobby Plan)"
    render = "Free (up to 750 hours/month)"
    newrelic = "Free (up to 100GB/month)"
    grafana = "Free (up to 10k series)"
    terraform_cloud = "Free (up to 5 users)"
    total_monthly_cost = "$0"
  }
}