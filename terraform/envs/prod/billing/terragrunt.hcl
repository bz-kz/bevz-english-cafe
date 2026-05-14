include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "${get_repo_root()}/terraform/modules/billing-killswitch"
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl"))
}

# Bootstrap-style stack. Like `wif`, this needs billing-account-level IAM and
# is run from a developer laptop with their own gcloud ADC; the HCP workspace
# should be set to Local execution mode after first init. Re-applies are
# rare (only on budget threshold or amount changes).
inputs = {
  gcp_project_id     = local.env.locals.gcp_project_id
  billing_account_id = "015032-CC5A81-BFE7CA"
  amount_jpy         = 2000
  notification_email = "kodaira@bz-kz.com"
  region             = local.env.locals.region
}
