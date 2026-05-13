# Root configuration for all stacks under terraform/.
# Owns the HCP Terraform remote backend.
# Provider generation is stack-specific: vercel blocks live in the vercel stack's
# local generate blocks; GCP stacks declare the google provider in their versions.tf.

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

# Vercel provider and variables are generated only for the vercel stack.
# They have been moved into terraform/envs/prod/vercel/terragrunt.hcl as
# stack-local generate blocks so GCP stacks don't receive undefined variables.
