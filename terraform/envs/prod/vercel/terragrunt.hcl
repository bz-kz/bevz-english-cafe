include "root" {
  path = find_in_parent_folders("root.hcl")
}

include "env" {
  path = find_in_parent_folders("env.hcl")
}

terraform {
  source = "${get_repo_root()}/terraform/modules/vercel-project"
}

# Vercel provider and its required variables are stack-local; GCP stacks must not
# receive these declarations, so they are generated here rather than in root.hcl.
generate "provider_vercel" {
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

# Inputs committed in code (non-secret). Values for `env_vars`, secrets, and the
# HCP organization name live in HCP Terraform workspace variables — see terraform/README.md.
#
# NOTE: `env_vars` is intentionally NOT set here. Terragrunt writes inputs to
# `terragrunt.auto.tfvars.json`, which Terraform reads at a higher precedence
# than HCP's runtime `terraform.tfvars` injection — so setting `env_vars = {}`
# here would silently override the workspace's HCL value.
inputs = {
  project_name      = "english-cafe-prod"
  github_repo       = "bz-kz/bevz-english-cafe"
  production_branch = "main"
  frontend_domain   = "english-cafe.bz-kz.com"
}
