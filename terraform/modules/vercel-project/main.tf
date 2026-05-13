resource "vercel_project" "this" {
  name      = var.project_name
  framework = var.framework
  team_id   = var.team_id

  root_directory   = var.root_directory
  build_command    = "npm run build"
  install_command  = "npm install"
  output_directory = ".next"

  git_repository = {
    type              = "github"
    repo              = var.github_repo
    production_branch = var.production_branch
  }
}

resource "vercel_project_environment_variable" "this" {
  for_each = var.env_vars

  project_id = vercel_project.this.id
  team_id    = var.team_id
  key        = each.key
  value      = each.value.value
  target     = each.value.target
  sensitive  = each.value.sensitive
}

resource "vercel_project_domain" "this" {
  count = var.custom_domain != "" ? 1 : 0

  project_id = vercel_project.this.id
  team_id    = var.team_id
  domain     = var.custom_domain
}
