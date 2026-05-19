# ══════════════════════════════════════════════════════════════════════════════
# FASE 1: CodeCommit + CodeBuild + CodePipeline
# Para deshabilitar: renombrar a pipeline-codecommit.tf.disabled
# ══════════════════════════════════════════════════════════════════════════════

# ── CodeCommit repo ───────────────────────────────────────────────────────────
resource "aws_codecommit_repository" "blog" {
  repository_name = "${var.project}-blog"
  description     = "Blog personal de Miguel Anay — Astro + Lambda API"
  tags            = local.common_tags
}

# ── S3 bucket para artefactos del pipeline ───────────────────────────────────
resource "aws_s3_bucket" "pipeline_artifacts" {
  bucket        = "${var.project}-pipeline-artifacts-${data.aws_caller_identity.current.account_id}"
  force_destroy = true
  tags          = local.common_tags
}

resource "aws_s3_bucket_versioning" "pipeline_artifacts" {
  bucket = aws_s3_bucket.pipeline_artifacts.id
  versioning_configuration { status = "Enabled" }
}

data "aws_caller_identity" "current" {}

# ── IAM role para CodeBuild ───────────────────────────────────────────────────
resource "aws_iam_role" "codebuild" {
  name = "${var.project}-codebuild-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "codebuild.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = local.common_tags
}

resource "aws_iam_role_policy" "codebuild" {
  role = aws_iam_role.codebuild.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:GetObjectVersion", "s3:GetBucketVersioning"]
        Resource = ["${aws_s3_bucket.pipeline_artifacts.arn}", "${aws_s3_bucket.pipeline_artifacts.arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:DeleteObject", "s3:GetObject", "s3:ListBucket"]
        Resource = ["arn:aws:s3:::${var.frontend_bucket_name}", "arn:aws:s3:::${var.frontend_bucket_name}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["lambda:UpdateFunctionCode", "lambda:UpdateFunctionConfiguration"]
        Resource = [
          aws_lambda_function.blog_api.arn,
          aws_lambda_function.astro_ssr.arn,
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:GetParameters"]
        Resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project}/*"
      }
    ]
  })
}

# ── IAM role para CodePipeline ────────────────────────────────────────────────
resource "aws_iam_role" "codepipeline" {
  name = "${var.project}-codepipeline-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "codepipeline.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = local.common_tags
}

resource "aws_iam_role_policy" "codepipeline" {
  role = aws_iam_role.codepipeline.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:GetObjectVersion", "s3:GetBucketVersioning", "s3:ListBucket"]
        Resource = ["${aws_s3_bucket.pipeline_artifacts.arn}", "${aws_s3_bucket.pipeline_artifacts.arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["codecommit:GetBranch", "codecommit:GetCommit", "codecommit:UploadArchive", "codecommit:GetUploadArchiveStatus"]
        Resource = aws_codecommit_repository.blog.arn
      },
      {
        Effect   = "Allow"
        Action   = ["codebuild:BatchGetBuilds", "codebuild:StartBuild"]
        Resource = aws_codebuild_project.blog.arn
      }
    ]
  })
}

# ── SSM Parameters (secretos para CodeBuild) ─────────────────────────────────
resource "aws_ssm_parameter" "turso_url" {
  name  = "/${var.project}/TURSO_URL"
  type  = "SecureString"
  value = var.turso_url
  tags  = local.common_tags
}

resource "aws_ssm_parameter" "turso_token" {
  name  = "/${var.project}/TURSO_TOKEN"
  type  = "SecureString"
  value = var.turso_token
  tags  = local.common_tags
}

resource "aws_ssm_parameter" "api_secret" {
  name  = "/${var.project}/API_SECRET"
  type  = "SecureString"
  value = var.api_secret
  tags  = local.common_tags
}

resource "aws_ssm_parameter" "resend_api_key" {
  name  = "/${var.project}/RESEND_API_KEY"
  type  = "SecureString"
  value = var.resend_api_key
  tags  = local.common_tags
}

resource "aws_ssm_parameter" "resend_audience_id" {
  name  = "/${var.project}/RESEND_AUDIENCE_ID"
  type  = "SecureString"
  value = var.resend_audience_id
  tags  = local.common_tags
}

# ── CodeBuild project ─────────────────────────────────────────────────────────
resource "aws_codebuild_project" "blog" {
  name          = "${var.project}-blog-build"
  service_role  = aws_iam_role.codebuild.arn
  build_timeout = 20
  tags          = local.common_tags

  artifacts {
    type = "CODEPIPELINE"
  }

  environment {
    compute_type    = "BUILD_GENERAL1_SMALL"
    image           = "aws/codebuild/standard:7.0"
    type            = "LINUX_CONTAINER"

    environment_variable {
      name  = "TURSO_URL"
      value = "/${var.project}/TURSO_URL"
      type  = "PARAMETER_STORE"
    }
    environment_variable {
      name  = "TURSO_TOKEN"
      value = "/${var.project}/TURSO_TOKEN"
      type  = "PARAMETER_STORE"
    }
    environment_variable {
      name  = "API_SECRET"
      value = "/${var.project}/API_SECRET"
      type  = "PARAMETER_STORE"
    }
    environment_variable {
      name  = "RESEND_API_KEY"
      value = "/${var.project}/RESEND_API_KEY"
      type  = "PARAMETER_STORE"
    }
    environment_variable {
      name  = "RESEND_AUDIENCE_ID"
      value = "/${var.project}/RESEND_AUDIENCE_ID"
      type  = "PARAMETER_STORE"
    }
    environment_variable {
      name  = "FRONTEND_BUCKET"
      value = var.frontend_bucket_name
      type  = "PLAINTEXT"
    }
    environment_variable {
      name  = "LAMBDA_FUNCTION"
      value = aws_lambda_function.blog_api.function_name
      type  = "PLAINTEXT"
    }
    environment_variable {
      name  = "CF_DISTRIBUTION_ID"
      value = aws_cloudfront_distribution.frontend.id
      type  = "PLAINTEXT"
    }
    environment_variable {
      name  = "API_URL"
      value = aws_lambda_function_url.blog_api.function_url
      type  = "PLAINTEXT"
    }
    environment_variable {
      name  = "SSR_LAMBDA_FUNCTION"
      value = aws_lambda_function.astro_ssr.function_name
      type  = "PLAINTEXT"
    }
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = "buildspec.yml"
  }
}

# ── CodePipeline ──────────────────────────────────────────────────────────────
resource "aws_codepipeline" "blog" {
  name     = "${var.project}-blog-pipeline"
  role_arn = aws_iam_role.codepipeline.arn
  tags     = local.common_tags

  artifact_store {
    location = aws_s3_bucket.pipeline_artifacts.bucket
    type     = "S3"
  }

  stage {
    name = "Source"
    action {
      name             = "CodeCommit"
      category         = "Source"
      owner            = "AWS"
      provider         = "CodeCommit"
      version          = "1"
      output_artifacts = ["source"]
      configuration = {
        RepositoryName       = aws_codecommit_repository.blog.repository_name
        BranchName           = "main"
        PollForSourceChanges = true
      }
    }
  }

  stage {
    name = "Build"
    action {
      name            = "Build"
      category        = "Build"
      owner           = "AWS"
      provider        = "CodeBuild"
      version         = "1"
      input_artifacts = ["source"]
      configuration = {
        ProjectName = aws_codebuild_project.blog.name
      }
    }
  }
}

# ── Outputs ───────────────────────────────────────────────────────────────────
output "codecommit_clone_url_https" {
  value       = aws_codecommit_repository.blog.clone_url_http
  description = "URL para clonar via HTTPS (usar git-remote-codecommit)"
}

output "codecommit_clone_url_ssh" {
  value       = aws_codecommit_repository.blog.clone_url_ssh
  description = "URL para clonar via SSH"
}

output "pipeline_name" {
  value = aws_codepipeline.blog.name
}
