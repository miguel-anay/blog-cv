output "lambda_function_url" {
  description = "Lambda Function URL — blog-api (artículos, CV, newsletter)"
  value       = aws_lambda_function_url.blog_api.function_url
}

output "ssr_lambda_function_url" {
  description = "Lambda Function URL — Astro SSR (directo, sin CloudFront)"
  value       = aws_lambda_function_url.astro_ssr.function_url
}

output "cloudfront_domain" {
  description = "CloudFront domain — apuntá tu dominio acá con CNAME"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID — necesario para invalidaciones en CI/CD"
  value       = aws_cloudfront_distribution.frontend.id
}

output "frontend_bucket_name" {
  description = "S3 bucket del frontend — para el sync de Astro build"
  value       = aws_s3_bucket.frontend.bucket
}

output "media_bucket_name" {
  description = "S3 bucket de media — para migrar uploads de Strapi"
  value       = aws_s3_bucket.media.bucket
}

output "media_bucket_domain" {
  description = "Dominio público del bucket de media (usar como base URL de imágenes)"
  value       = "https://${aws_s3_bucket.media.bucket}.s3.${var.aws_region}.amazonaws.com"
}

