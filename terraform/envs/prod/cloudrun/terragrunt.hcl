include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "${get_repo_root()}/terraform/modules/cloud-run-service"
}

# See wif/terragrunt.hcl for why `include "env"` is omitted in favor of an
# explicit `read_terragrunt_config`.
locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl"))
}

dependency "firestore" {
  config_path = "../firestore"
  mock_outputs = {
    name        = "projects/english-cafe-496209/databases/(default)"
    location_id = "asia-northeast1"
  }
}

# `image` must be set as HCP workspace variable TF_VAR_image (sensitive=false).
# For initial bootstrap, set: TF_VAR_image=us-docker.pkg.dev/cloudrun/container/hello
# Phase C will update it to the real Artifact Registry URI after the first image push.
inputs = {
  gcp_project_id = local.env.locals.gcp_project_id
  region         = local.env.locals.region
  service_name   = "english-cafe-api"
  custom_domain  = "api.bz-kz.com"

  env_vars = {
    GCP_PROJECT_ID     = local.env.locals.gcp_project_id
    REPOSITORY_BACKEND = "sqlalchemy" # Phase C flips this to "firestore"
    ENVIRONMENT        = "production"
  }
}
