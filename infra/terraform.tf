terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Descomenta para usar S3 como backend remoto (recomendado en producción)
  # backend "s3" {
  #   bucket = "YOUR-TFSTATE-BUCKET"
  #   key    = "blog/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region = var.aws_region
}
