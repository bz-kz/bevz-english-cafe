variable "project_name" {
  type        = string
  description = "Vercel project name. Must match the existing project name for import to succeed."
}

variable "framework" {
  type        = string
  default     = "nextjs"
  description = "Vercel framework preset."
}

variable "root_directory" {
  type        = string
  default     = "frontend"
  description = "Subdirectory in the repo where the deployable app lives."
}

variable "team_id" {
  type        = string
  default     = null
  description = "Vercel team ID. Null for personal Hobby accounts."
}

variable "github_repo" {
  type        = string
  description = "GitHub repo in 'owner/repo' format used for the Git integration."
}

variable "production_branch" {
  type        = string
  default     = "main"
  description = "Git branch that triggers production deployments."
}

variable "frontend_domain" {
  type        = string
  default     = ""
  description = "Custom domain to bind to this Vercel project. Empty string skips the domain resource."
}

variable "serverless_function_region" {
  type        = string
  default     = "sfo1"
  description = "Vercel serverless function deployment region (e.g. sfo1, hnd1, iad1)."
}

variable "env_vars" {
  type = map(object({
    value     = string
    target    = list(string)
    sensitive = optional(bool, false)
  }))
  default     = {}
  description = "Environment variables, keyed by variable name. target is a subset of [production, preview, development]."
}
