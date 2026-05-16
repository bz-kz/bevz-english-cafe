include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "${get_repo_root()}/terraform/modules/gcp-wif"
}

# `include "env"` is omitted: Terragrunt does not expose included locals under
# `local.` in the child stack, so the include is inert. We pull the shared
# locals explicitly via `read_terragrunt_config` below.
locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl"))
}

# Bootstrap stack — must apply first before firestore and cloudrun can use WIF.
# After apply, copy `runner_service_account_email` and `provider_name` outputs
# into the firestore and cloudrun HCP workspaces as workspace variables
# (TFC_GCP_RUN_SERVICE_ACCOUNT_EMAIL and TFC_GCP_WORKLOAD_PROVIDER_NAME).
# See terraform/README.md for the full bootstrap sequence.
# After apply also copy `github_wif_provider_name` and
# `deployer_service_account_email` outputs into GitHub repo Actions
# Variables as GCP_WIF_PROVIDER and GCP_DEPLOYER_SA (see spec Ops checklist).
inputs = {
  gcp_project_id    = local.env.locals.gcp_project_id
  hcp_organization  = local.env.locals.hcp_organization
  github_repository = "bz-kz/bevz-english-cafe"
}
