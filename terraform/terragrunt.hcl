# Root configuration for all stacks under terraform/.
# Owns the HCP Terraform remote backend and the Vercel provider declaration.

locals {
  env_vars     = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  organization = get_env("HCP_TF_ORGANIZATION")
  project_slug = "english-cafe"

  # Stack name is derived from path under envs/<env>/, e.g. "vercel".
  stack_name = replace(path_relative_to_include(), "/", "-")
}

remote_state {
  backend = "remote"

  generate = {
    path      = "backend.tf"
    if_exists = "overwrite"
  }

  config = {
    hostname     = "app.terraform.io"
    organization = local.organization

    workspaces = {
      name = "${local.project_slug}-${local.env_vars.locals.environment}-${local.stack_name}"
    }
  }
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "vercel" {
  api_token = var.vercel_api_token
  team      = var.vercel_team_id
}
EOF
}

generate "common_variables" {
  path      = "common_variables.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
variable "vercel_api_token" {
  type        = string
  sensitive   = true
  description = "Vercel API token. Set via HCP Terraform workspace variable."
}

variable "vercel_team_id" {
  type        = string
  default     = null
  description = "Vercel team ID. Null for personal Hobby accounts."
}
EOF
}
