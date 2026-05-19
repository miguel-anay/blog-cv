variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name used as prefix for all resources"
  type        = string
  default     = "blog"
}

# ── S3 ────────────────────────────────────────────────────────────────────────

variable "media_bucket_name" {
  description = "S3 bucket name for media uploads (cover images, CV assets)"
  type        = string
}

variable "frontend_bucket_name" {
  description = "S3 bucket name for Astro static site"
  type        = string
}

# ── Lambda ────────────────────────────────────────────────────────────────────

variable "lambda_zip_path" {
  description = "Path to the Lambda deployment zip (output of esbuild build)"
  type        = string
  default     = "../blog-api/dist/handler.zip"
}

variable "lambda_memory_mb" {
  description = "Lambda memory in MB"
  type        = number
  default     = 512
}

variable "lambda_timeout_s" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 10
}

# ── Lambda env vars (sensitive) ───────────────────────────────────────────────

variable "turso_url" {
  description = "Turso database URL (libsql://...)"
  type        = string
  sensitive   = true
}

variable "turso_token" {
  description = "Turso database auth token"
  type        = string
  sensitive   = true
}

variable "api_secret" {
  description = "Bearer token for write endpoints"
  type        = string
  sensitive   = true
}

variable "resend_api_key" {
  description = "Resend API key for newsletter"
  type        = string
  sensitive   = true
  default     = ""
}

variable "resend_audience_id" {
  description = "Resend audience ID for newsletter subscribers"
  type        = string
  sensitive   = true
  default     = ""
}

variable "site_url" {
  description = "Public site URL for CORS (e.g. https://miguel-anay.nom.pe)"
  type        = string
}

# ── SSR Lambda ────────────────────────────────────────────────────────────────

variable "ssr_zip_path" {
  description = "Path to the Astro SSR Lambda zip (output of build-ssr.sh)"
  type        = string
  default     = "../dist/ssr.zip"
}

variable "ssr_lambda_memory_mb" {
  description = "Astro SSR Lambda memory in MB"
  type        = number
  default     = 512
}

variable "ssr_lambda_timeout_s" {
  description = "Astro SSR Lambda timeout in seconds"
  type        = number
  default     = 30
}
