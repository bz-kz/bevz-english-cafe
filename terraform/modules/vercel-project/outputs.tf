output "project_id" {
  value       = vercel_project.this.id
  description = "Vercel project ID. Future stacks (backend, monitoring) reference this."
}

output "production_url" {
  value       = "https://${vercel_project.this.name}.vercel.app"
  description = "Default vercel.app production URL. Custom domains are separate."
}
