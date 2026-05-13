include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "${get_repo_root()}/terraform/modules/firestore-database"
}

# See wif/terragrunt.hcl for why `include "env"` is omitted in favor of an
# explicit `read_terragrunt_config`.
locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl"))
}

inputs = {
  gcp_project_id = local.env.locals.gcp_project_id
  location_id    = local.env.locals.region
}
