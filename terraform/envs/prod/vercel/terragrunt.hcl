include "root" {
  path = find_in_parent_folders("root.hcl")
}

include "env" {
  path = find_in_parent_folders("env.hcl")
}

terraform {
  source = "${get_repo_root()}/terraform/modules/vercel-project"
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
