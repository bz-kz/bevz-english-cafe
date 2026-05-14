include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "${get_repo_root()}/terraform/modules/cloud-function-slot-generator"
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl"))
}

inputs = {
  gcp_project_id = local.env.locals.gcp_project_id
  region         = local.env.locals.region
}
