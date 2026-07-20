output "api_ecr_repository_url" {

  value = aws_ecr_repository.api.repository_url

}
output "api_load_balancer_dns" {

  value = aws_lb.api.dns_name

}
output "ecs_cluster_name" {

  value = aws_ecs_cluster.main.name

}
output "ecs_service_name" {

  value = aws_ecs_service.api.name

}
output "ecs_task_definition_family" {

  value = aws_ecs_task_definition.api.family

}
output "frontend_bucket" {

  value = aws_s3_bucket.frontend.id

}
output "cloudfront_distribution_id" {

  value = aws_cloudfront_distribution.frontend.id

}
output "cloudfront_domain" {

  value = aws_cloudfront_distribution.frontend.domain_name

}
output "app_secret_arn" {

  value = aws_secretsmanager_secret.app.arn

  sensitive = true

}

