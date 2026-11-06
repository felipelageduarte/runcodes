output "public_url" {
  value       = "https://${aws_cloudfront_distribution.app.domain_name}"
  description = "URL pública do runcodes"
}

output "instance_id" {
  value = aws_instance.app.id
}

output "backup_bucket" {
  value = aws_s3_bucket.backups.bucket
}

output "github_deploy_role_arn" {
  value       = aws_iam_role.github_deploy.arn
  description = "Role assumida pelo workflow de deploy (push na main)"
}

output "github_plan_role_arn" {
  value       = aws_iam_role.github_plan.arn
  description = "Role assumida pelo workflow de CI (terraform plan em PRs)"
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.app.id
}
