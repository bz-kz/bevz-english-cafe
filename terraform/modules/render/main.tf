# Render Custom Provider Module
# Note: This is a workaround using null_resource and local-exec

terraform {
  required_providers {
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}

# Render Service Configuration via API
resource "null_resource" "render_service" {
  triggers = {
    service_name    = var.service_name
    github_repo     = var.github_repo
    branch          = var.branch
    build_command   = var.build_command
    start_command   = var.start_command
    environment     = var.environment
    instance_type   = var.instance_type
    api_key         = var.render_api_key  # Include API key in triggers for destroy
  }

  # Create Render service via API
  provisioner "local-exec" {
    command = <<-EOT
      curl -X POST "https://api.render.com/v1/services" \
        -H "Authorization: Bearer ${var.render_api_key}" \
        -H "Content-Type: application/json" \
        -d '{
          "type": "web_service",
          "name": "${var.service_name}",
          "repo": "${var.github_repo}",
          "branch": "${var.branch}",
          "buildCommand": "${var.build_command}",
          "startCommand": "${var.start_command}",
          "envVars": ${jsonencode([for k, v in var.environment_variables : {
            key = k
            value = v
          }])},
          "serviceDetails": {
            "env": "${var.environment}",
            "plan": "${var.instance_type}",
            "region": "${var.region}",
            "buildFilter": {
              "paths": ["backend/**"]
            }
          }
        }' > render_service_response.json
    EOT
  }

  # Update Render service via API
  provisioner "local-exec" {
    when = create
    command = <<-EOT
      SERVICE_ID=$(cat render_service_response.json | jq -r '.id')
      echo $SERVICE_ID > render_service_id.txt
    EOT
  }

  # Delete Render service via API
  provisioner "local-exec" {
    when    = destroy
    command = <<-EOT
      if [ -f render_service_id.txt ]; then
        SERVICE_ID=$(cat render_service_id.txt)
        curl -X DELETE "https://api.render.com/v1/services/$SERVICE_ID" \
          -H "Authorization: Bearer ${self.triggers.api_key}"
        rm -f render_service_id.txt render_service_response.json
      fi
    EOT
  }
}

# Render Database Configuration
resource "null_resource" "render_database" {
  count = var.create_database ? 1 : 0

  triggers = {
    database_name = var.database_name
    database_plan = var.database_plan
    region        = var.region
    api_key       = var.render_api_key  # Include API key in triggers for destroy
  }

  provisioner "local-exec" {
    command = <<-EOT
      curl -X POST "https://api.render.com/v1/postgres" \
        -H "Authorization: Bearer ${var.render_api_key}" \
        -H "Content-Type: application/json" \
        -d '{
          "name": "${var.database_name}",
          "plan": "${var.database_plan}",
          "region": "${var.region}",
          "version": "15"
        }' > render_database_response.json
    EOT
  }

  provisioner "local-exec" {
    when = create
    command = <<-EOT
      DB_ID=$(cat render_database_response.json | jq -r '.id')
      echo $DB_ID > render_database_id.txt
    EOT
  }

  provisioner "local-exec" {
    when    = destroy
    command = <<-EOT
      if [ -f render_database_id.txt ]; then
        DB_ID=$(cat render_database_id.txt)
        curl -X DELETE "https://api.render.com/v1/postgres/$DB_ID" \
          -H "Authorization: Bearer ${self.triggers.api_key}"
        rm -f render_database_id.txt render_database_response.json
      fi
    EOT
  }
}

# Environment Variables Update
resource "null_resource" "render_env_vars" {
  depends_on = [null_resource.render_service]

  triggers = {
    env_vars_hash = md5(jsonencode(var.environment_variables))
  }

  provisioner "local-exec" {
    command = <<-EOT
      if [ -f render_service_id.txt ]; then
        SERVICE_ID=$(cat render_service_id.txt)
        curl -X PUT "https://api.render.com/v1/services/$SERVICE_ID/env-vars" \
          -H "Authorization: Bearer ${var.render_api_key}" \
          -H "Content-Type: application/json" \
          -d '${jsonencode([for k, v in var.environment_variables : {
            key = k
            value = v
          }])}'
      fi
    EOT
  }
}