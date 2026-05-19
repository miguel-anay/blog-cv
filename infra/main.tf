locals {
  name_prefix = var.project
  common_tags = {
    Project     = var.project
    ManagedBy   = "terraform"
  }
}

# ══════════════════════════════════════════════════════════════════════════════
# S3 — MEDIA BUCKET (public read, for cover images and CV assets)
# ══════════════════════════════════════════════════════════════════════════════

resource "aws_s3_bucket" "media" {
  bucket = var.media_bucket_name
  tags   = local.common_tags
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "media_public_read" {
  bucket     = aws_s3_bucket.media.id
  depends_on = [aws_s3_bucket_public_access_block.media]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.media.arn}/*"
      }
    ]
  })
}

resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET"]
    allowed_origins = [var.site_url, "http://localhost:4321"]
    max_age_seconds = 3600
  }
}

# ══════════════════════════════════════════════════════════════════════════════
# S3 — FRONTEND BUCKET (Astro SSG static site)
# ══════════════════════════════════════════════════════════════════════════════

resource "aws_s3_bucket" "frontend" {
  bucket = var.frontend_bucket_name
  tags   = local.common_tags
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document { suffix = "index.html" }
  error_document { key = "404.html" }
}

# ══════════════════════════════════════════════════════════════════════════════
# CLOUDFRONT — Frontend distribution (S3 origin, OAC)
# ══════════════════════════════════════════════════════════════════════════════

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${local.name_prefix}-frontend-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = ""
  price_class         = "PriceClass_100" # US + Europe — cheapest
  tags                = local.common_tags

  # Origin 1: S3 — static assets from dist/client/
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "s3-frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # Origin 2: Astro SSR Lambda — handles all page routes
  origin {
    domain_name = replace(replace(aws_lambda_function_url.astro_ssr.function_url, "https://", ""), "/", "")
    origin_id   = "lambda-ssr"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Origin Group: S3 primary, Lambda fallback (S3 returns 403 for missing objects)
  origin_group {
    origin_id = "blog-failover"

    failover_criteria {
      status_codes = [403, 404, 500, 502, 503, 504]
    }

    member { origin_id = "s3-frontend" }
    member { origin_id = "lambda-ssr" }
  }

  # Default behavior: try S3, fall back to SSR Lambda
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "blog-failover"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = true
      headers      = ["Accept", "Accept-Encoding", "Accept-Language"]
      cookies { forward = "none" }
    }

    min_ttl     = 0
    default_ttl = 0   # SSR: no default cache
    max_ttl     = 60  # Allow up to 60s if Lambda sets Cache-Control
  }

  # _astro/* — hashed assets, always on S3, immutable cache (no failover needed)
  ordered_cache_behavior {
    path_pattern           = "/_astro/*"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-frontend"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    min_ttl     = 31536000
    default_ttl = 31536000
    max_ttl     = 31536000
  }

  # SSR Lambda handles all errors natively (404, 500, etc.)

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    # Descomenta para dominio personalizado con ACM:
    # acm_certificate_arn      = aws_acm_certificate.blog.arn
    # ssl_support_method       = "sni-only"
    # minimum_protocol_version = "TLSv1.2_2021"
  }
}

# Política para que CloudFront acceda al bucket frontend (privado)
resource "aws_s3_bucket_policy" "frontend_cloudfront" {
  bucket     = aws_s3_bucket.frontend.id
  depends_on = [aws_s3_bucket_public_access_block.frontend]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOAC"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })
}

# ══════════════════════════════════════════════════════════════════════════════
# IAM — Lambda execution role
# ══════════════════════════════════════════════════════════════════════════════

resource "aws_iam_role" "lambda" {
  name = "${local.name_prefix}-api-lambda-role"
  tags = local.common_tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Permisos para leer el bucket de media (si necesita generar URLs presignadas)
resource "aws_iam_role_policy" "lambda_s3_media" {
  name = "s3-media-read"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "MediaBucketRead"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:ListBucket"]
        Resource = [
          aws_s3_bucket.media.arn,
          "${aws_s3_bucket.media.arn}/*"
        ]
      }
    ]
  })
}

# ══════════════════════════════════════════════════════════════════════════════
# LAMBDA — blog-api function
# ══════════════════════════════════════════════════════════════════════════════

resource "aws_lambda_function" "blog_api" {
  function_name = "${local.name_prefix}-api"
  description   = "Hono blog API — articles, categories, CV, site config, newsletter"
  role          = aws_iam_role.lambda.arn

  filename         = var.lambda_zip_path
  source_code_hash = filebase64sha256(var.lambda_zip_path)

  handler = "handler.handler"
  runtime = "nodejs22.x"

  memory_size = var.lambda_memory_mb
  timeout     = var.lambda_timeout_s

  environment {
    variables = {
      TURSO_URL          = var.turso_url
      TURSO_TOKEN        = var.turso_token
      API_SECRET         = var.api_secret
      RESEND_API_KEY     = var.resend_api_key
      RESEND_AUDIENCE_ID = var.resend_audience_id
      PUBLIC_SITE_URL    = var.site_url
      S3_BUCKET          = var.media_bucket_name
      S3_REGION          = var.aws_region
    }
  }

  tags = local.common_tags

  lifecycle {
    # Permite actualizar el zip sin recrear la función
    ignore_changes = [source_code_hash]
  }
}

# ── Function URL (pública, sin API Gateway) ───────────────────────────────────

resource "aws_lambda_function_url" "blog_api" {
  function_name      = aws_lambda_function.blog_api.function_name
  authorization_type = "NONE"

  cors {
    allow_origins  = [var.site_url, "http://localhost:4321"]
    allow_methods  = ["GET", "POST", "PATCH"]
    allow_headers  = ["Content-Type", "Authorization"]
    expose_headers = ["Content-Type"]
    max_age        = 3600
  }
}

# ══════════════════════════════════════════════════════════════════════════════
# LAMBDA — Astro SSR function
# ══════════════════════════════════════════════════════════════════════════════

resource "aws_iam_role" "lambda_ssr" {
  name = "${local.name_prefix}-ssr-lambda-role"
  tags = local.common_tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_ssr_basic" {
  role       = aws_iam_role.lambda_ssr.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "astro_ssr" {
  function_name = "${local.name_prefix}-ssr"
  description   = "Astro SSR — Node.js middleware serving blog pages dynamically"
  role          = aws_iam_role.lambda_ssr.arn

  filename         = var.ssr_zip_path
  source_code_hash = filebase64sha256(var.ssr_zip_path)

  handler = "handler.handler"
  runtime = "nodejs22.x"

  memory_size = var.ssr_lambda_memory_mb
  timeout     = var.ssr_lambda_timeout_s

  environment {
    variables = {
      API_URL = aws_lambda_function_url.blog_api.function_url
    }
  }

  tags = local.common_tags

  lifecycle {
    ignore_changes = [source_code_hash]
  }
}

resource "aws_lambda_function_url" "astro_ssr" {
  function_name      = aws_lambda_function.astro_ssr.function_name
  authorization_type = "NONE"

  cors {
    allow_origins = [var.site_url]
    allow_methods = ["GET", "HEAD"]
    allow_headers = ["Content-Type"]
    max_age       = 0
  }
}

