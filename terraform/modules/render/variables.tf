# Render Module Variables

variable "render_api_key" {
  description = "Render API key"
  type        = string
  sensitive   = true
}

variable "service_name" {
  description = "Name of the Render service"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository URL"
  type        = string
}

variable "branch" {
  description = "Git branch to deploy"
  type        = string
  default     = "main"
}

variable "build_command" {
  description = "Build command for the service"
  type        = string
  default     = "cd backend && pip install -r requirements.txt"
}

variable "start_command" {
  description = "Start command for the service"
  type        = string
  default     = "cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT"
}

variable "environment" {
  description = "Environment (free, starter, standard, pro)"
  type        = string
  default     = "free"
  
  validation {
    condition     = contains(["free", "starter", "standard", "pro"], var.environment)
    error_message = "Environment must be one of: free, starter, standard, pro."
  }
}

variable "instance_type" {
  description = "Instance type for the service"
  type        = string
  default     = "free"
}

variable "region" {
  description = "Render region"
  type        = string
  default     = "oregon"
  
  validation {
    condition = contains([
      "oregon", "ohio", "virginia", "frankfurt", "singapore"
    ], var.region)
    error_message = "Region must be one of: oregon, ohio, virginia, frankfurt, singapore."
  }
}

variable "environment_variables" {
  description = "Environment variables for the service"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "create_database" {
  description = "Whether to create a PostgreSQL database"
  type        = bool
  default     = true
}

variable "database_name" {
  description = "Name of the PostgreSQL database"
  type        = string
  default     = "english-cafe-db"
}

variable "database_plan" {
  description = "Database plan (free, starter, standard, pro)"
  type        = string
  default     = "free"
  
  validation {
    condition     = contains(["free", "starter", "standard", "pro"], var.database_plan)
    error_message = "Database plan must be one of: free, starter, standard, pro."
  }
}

variable "auto_deploy" {
  description = "Enable auto-deploy on git push"
  type        = bool
  default     = true
}

variable "health_check_path" {
  description = "Health check endpoint path"
  type        = string
  default     = "/health"
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}