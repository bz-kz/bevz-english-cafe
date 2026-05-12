# Render Module Outputs

output "service_id" {
  description = "Render service ID"
  value       = null_resource.render_service.id
}

output "service_name" {
  description = "Render service name"
  value       = var.service_name
}

output "service_url" {
  description = "Render service URL"
  value       = "https://${var.service_name}.onrender.com"
}

output "database_id" {
  description = "Render database ID (if created)"
  value       = var.create_database ? null_resource.render_database[0].id : null
}

output "database_name" {
  description = "Render database name"
  value       = var.create_database ? var.database_name : null
}

output "database_connection_string" {
  description = "Database connection string placeholder"
  value       = var.create_database ? "postgresql://user:password@${var.database_name}.render.com:5432/${var.database_name}" : null
  sensitive   = true
}

output "environment_variables" {
  description = "Environment variables configured for the service"
  value       = var.environment_variables
  sensitive   = true
}

output "deployment_info" {
  description = "Deployment information"
  value = {
    service_name  = var.service_name
    environment   = var.environment
    instance_type = var.instance_type
    region        = var.region
    auto_deploy   = var.auto_deploy
  }
}