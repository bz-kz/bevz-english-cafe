# Root configuration for all stacks under terraform/.
# Owns the HCP Terraform remote backend and the Vercel provider declaration.

locals {
  env_vars     = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  organization = local.env_vars.locals.hcp_organization
  project_slug = "english-cafe"

  # Stack name is the leaf dir under envs/<env>/, e.g. "vercel" or "cloudrun".
  stack_name     = basename(get_terragrunt_dir())
  workspace_name = "${local.project_slug}-${local.env_vars.locals.environment}-${local.stack_name}"
}

# Use the HCP Terraform `cloud {}` block (not `backend "remote"`) since the
# Terragrunt `remote_state` generator emits `workspaces = {}` as a map, which
# newer Terraform rejects for the remote backend.
generate "backend" {
  path      = "backend.tf"
  if_exists = "overwrite"
  contents  = <<EOF
terraform {
  cloud {
    hostname     = "app.terraform.io"
    organization = "${local.organization}"
    workspaces {
      name = "${local.workspace_name}"
    }
  }
}
EOF
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
