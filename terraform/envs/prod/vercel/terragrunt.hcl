include "root" {
  path = find_in_parent_folders("terragrunt.hcl")
}

include "env" {
  path = find_in_parent_folders("env.hcl")
}

terraform {
  source = "${get_repo_root()}/terraform/modules/vercel-project"
}

# Inputs committed in code (non-secret). Values for `env_vars`, secrets, and the
# HCP organization name live in HCP Terraform workspace variables — see terraform/README.md.
inputs = {
  project_name      = "english-cafe-frontend"
  github_repo       = "bz-kz/bevz-english-cafe"
  production_branch = "main"
  custom_domain     = "english-cafe.bz-kz.com"

  # env_vars is intentionally an empty default here. The actual env-var map is
  # injected via the HCP Terraform workspace variable `env_vars` (HCL/JSON typed),
  # which lets HCP keep the full value set under one sensitive variable.
  # See terraform/README.md "Environment variables" section for the JSON shape.
  env_vars = {}
}
