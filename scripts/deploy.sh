#!/bin/bash

# Script de despliegue manual para S3 + CloudFront
# Uso: ./scripts/deploy.sh [bucket-name] [region]

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables
BUCKET_NAME=${1:-$S3_BUCKET_NAME}
AWS_REGION=${2:-$AWS_REGION}
CLOUDFRONT_ID=${CLOUDFRONT_DISTRIBUTION_ID:-}
CLOUDFLARE_ZONE=${CLOUDFLARE_ZONE_ID:-}
CLOUDFLARE_TOKEN=${CLOUDFLARE_API_TOKEN:-}

# Función para imprimir mensajes
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validar variables requeridas
if [ -z "$BUCKET_NAME" ]; then
    print_error "Bucket name is required. Usage: ./scripts/deploy.sh [bucket-name] [region]"
    exit 1
fi

if [ -z "$AWS_REGION" ]; then
    AWS_REGION="us-east-1"
    print_warning "AWS region not specified, using default: $AWS_REGION"
fi

print_info "Starting deployment process..."
print_info "Bucket: $BUCKET_NAME"
print_info "Region: $AWS_REGION"

# Build del proyecto
print_info "Building Astro project..."
npm run build

if [ $? -ne 0 ]; then
    print_error "Build failed!"
    exit 1
fi

print_info "Build completed successfully!"

# Sync a S3 - Assets con cache largo
print_info "Syncing static assets to S3 (with long cache)..."
aws s3 sync dist/ s3://$BUCKET_NAME \
    --region $AWS_REGION \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "*.html" \
    --exclude "*.xml" \
    --exclude "*.txt" \
    --exclude "*.json"

# Sync a S3 - HTML files con cache corto
print_info "Syncing HTML files to S3 (with short cache)..."
aws s3 sync dist/ s3://$BUCKET_NAME \
    --region $AWS_REGION \
    --cache-control "public, max-age=0, must-revalidate" \
    --exclude "*" \
    --include "*.html" \
    --include "*.xml" \
    --include "*.txt" \
    --include "*.json"

if [ $? -ne 0 ]; then
    print_error "S3 sync failed!"
    exit 1
fi

print_info "S3 sync completed successfully!"

# Invalidar CloudFront (requerido)
if [ -n "$CLOUDFRONT_ID" ]; then
    print_info "Invalidating CloudFront cache (Distribution: $CLOUDFRONT_ID)..."

    INVALIDATION_OUTPUT=$(aws cloudfront create-invalidation \
        --distribution-id $CLOUDFRONT_ID \
        --paths "/*" \
        --output json)

    if [ $? -eq 0 ]; then
        INVALIDATION_ID=$(echo $INVALIDATION_OUTPUT | grep -o '"Id": "[^"]*"' | cut -d'"' -f4)
        print_info "CloudFront invalidation created: $INVALIDATION_ID"

        # Get CloudFront domain
        CLOUDFRONT_DOMAIN=$(aws cloudfront get-distribution \
            --id $CLOUDFRONT_ID \
            --query 'Distribution.DomainName' \
            --output text 2>/dev/null || echo "")

        if [ -n "$CLOUDFRONT_DOMAIN" ]; then
            CLOUDFRONT_URL="https://$CLOUDFRONT_DOMAIN"
        fi
    else
        print_error "CloudFront invalidation failed!"
        exit 1
    fi
else
    print_error "CLOUDFRONT_DISTRIBUTION_ID is required!"
    print_error "Set it in .env or pass as environment variable"
    exit 1
fi

# Resumen
echo ""
print_info "==========================================="
print_info "Deployment completed successfully! 🚀"
print_info "==========================================="
print_info "S3 Bucket: s3://$BUCKET_NAME"
print_info "Region: $AWS_REGION"
print_info "CloudFront Distribution: $CLOUDFRONT_ID"

if [ -n "$CLOUDFRONT_URL" ]; then
    print_info "CloudFront URL: $CLOUDFRONT_URL"
fi

if [ -n "$INVALIDATION_ID" ]; then
    print_info "Invalidation ID: $INVALIDATION_ID"
fi

echo ""
print_info "Your site is live at: $CLOUDFRONT_URL"
print_warning "CloudFront invalidation may take 1-5 minutes to complete"
echo ""
print_info "Check invalidation status:"
echo "  aws cloudfront get-invalidation --distribution-id $CLOUDFRONT_ID --id $INVALIDATION_ID"
