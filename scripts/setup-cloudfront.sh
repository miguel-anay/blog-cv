#!/bin/bash

# Script para crear y configurar CloudFront Distribution para sitio Astro
# Uso: ./scripts/setup-cloudfront.sh [bucket-name] [region]

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
BUCKET_NAME=${1:-$S3_BUCKET_NAME}
AWS_REGION=${2:-${AWS_REGION:-us-east-1}}

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Validar bucket name
if [ -z "$BUCKET_NAME" ]; then
    print_error "Bucket name is required!"
    echo "Usage: ./scripts/setup-cloudfront.sh [bucket-name] [region]"
    exit 1
fi

print_info "Starting CloudFront setup for bucket: $BUCKET_NAME"
echo ""

# Paso 1: Verificar que el bucket existe
print_step "1/5: Verifying S3 bucket..."
if aws s3 ls "s3://$BUCKET_NAME" --region $AWS_REGION > /dev/null 2>&1; then
    print_info "Bucket verified: $BUCKET_NAME"
else
    print_error "Bucket not found: $BUCKET_NAME"
    exit 1
fi

# Paso 2: Crear Origin Access Identity (OAI)
print_step "2/5: Creating CloudFront Origin Access Identity..."

OAI_COMMENT="OAI for $BUCKET_NAME"
OAI_OUTPUT=$(aws cloudfront create-cloud-front-origin-access-identity \
    --cloud-front-origin-access-identity-config \
    "CallerReference=$(date +%s),Comment=$OAI_COMMENT" \
    --output json 2>/dev/null || echo "exists")

if [ "$OAI_OUTPUT" = "exists" ]; then
    print_warning "OAI may already exist, continuing..."
    # Get existing OAI
    OAI_ID=$(aws cloudfront list-cloud-front-origin-access-identities \
        --query "CloudFrontOriginAccessIdentityList.Items[?Comment=='$OAI_COMMENT'].Id" \
        --output text | head -1)
else
    OAI_ID=$(echo $OAI_OUTPUT | jq -r '.CloudFrontOriginAccessIdentity.Id')
    print_info "OAI created: $OAI_ID"
fi

# Obtener S3 Canonical User ID
S3_CANONICAL_USER=$(aws cloudfront get-cloud-front-origin-access-identity \
    --id $OAI_ID \
    --query 'CloudFrontOriginAccessIdentity.S3CanonicalUserId' \
    --output text)

print_info "S3 Canonical User ID: $S3_CANONICAL_USER"

# Paso 3: Actualizar bucket policy para CloudFront
print_step "3/5: Updating S3 bucket policy for CloudFront..."

cat > /tmp/bucket-policy-cloudfront.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudFrontOAI",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity $OAI_ID"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy \
    --bucket $BUCKET_NAME \
    --policy file:///tmp/bucket-policy-cloudfront.json

print_info "Bucket policy updated"

# Paso 4: Crear CloudFront distribution
print_step "4/5: Creating CloudFront distribution..."

DISTRIBUTION_CONFIG=$(cat <<EOF
{
  "CallerReference": "$(date +%s)",
  "Comment": "Astro Site - $BUCKET_NAME",
  "Enabled": true,
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-$BUCKET_NAME",
        "DomainName": "$BUCKET_NAME.s3.$AWS_REGION.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": "origin-access-identity/cloudfront/$OAI_ID"
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-$BUCKET_NAME",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": {
        "Quantity": 2,
        "Items": ["GET", "HEAD"]
      }
    },
    "Compress": true,
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000,
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {
        "Forward": "none"
      }
    }
  },
  "CustomErrorResponses": {
    "Quantity": 2,
    "Items": [
      {
        "ErrorCode": 403,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      },
      {
        "ErrorCode": 404,
        "ResponsePagePath": "/404.html",
        "ResponseCode": "404",
        "ErrorCachingMinTTL": 300
      }
    ]
  },
  "PriceClass": "PriceClass_100",
  "ViewerCertificate": {
    "CloudFrontDefaultCertificate": true,
    "MinimumProtocolVersion": "TLSv1.2_2021"
  }
}
EOF
)

DISTRIBUTION_OUTPUT=$(aws cloudfront create-distribution \
    --distribution-config "$DISTRIBUTION_CONFIG" \
    --output json)

DISTRIBUTION_ID=$(echo $DISTRIBUTION_OUTPUT | jq -r '.Distribution.Id')
DISTRIBUTION_DOMAIN=$(echo $DISTRIBUTION_OUTPUT | jq -r '.Distribution.DomainName')

print_info "CloudFront distribution created!"
print_info "Distribution ID: $DISTRIBUTION_ID"
print_info "Distribution Domain: $DISTRIBUTION_DOMAIN"

# Paso 5: Guardar configuración
print_step "5/5: Saving configuration..."

cat > cloudfront-config.txt <<EOF
CloudFront Configuration
========================

Bucket Name: $BUCKET_NAME
AWS Region: $AWS_REGION
OAI ID: $OAI_ID
Distribution ID: $DISTRIBUTION_ID
CloudFront Domain: $DISTRIBUTION_DOMAIN
CloudFront URL: https://$DISTRIBUTION_DOMAIN

GitHub Secrets Required:
------------------------
CLOUDFRONT_DISTRIBUTION_ID=$DISTRIBUTION_ID

Next Steps:
-----------
1. Add CLOUDFRONT_DISTRIBUTION_ID to GitHub Secrets
2. Wait 10-15 minutes for CloudFront to deploy
3. Test your site: https://$DISTRIBUTION_DOMAIN
4. Configure custom domain (optional):
   - Request ACM certificate in us-east-1
   - Add alternate domain name to CloudFront
   - Update DNS to point to CloudFront

DNS Configuration (if using custom domain):
-------------------------------------------
Type: CNAME
Name: www (or @)
Value: $DISTRIBUTION_DOMAIN

Or for apex domain, use Route 53 Alias:
Type: A (Alias)
Name: @
Target: $DISTRIBUTION_DOMAIN (CloudFront distribution)
EOF

print_info "Configuration saved to cloudfront-config.txt"

# Resumen final
echo ""
echo "======================================"
print_info "CloudFront Setup Complete! 🚀"
echo "======================================"
echo ""
print_info "Distribution ID: $DISTRIBUTION_ID"
print_info "CloudFront URL: https://$DISTRIBUTION_DOMAIN"
echo ""
print_warning "The distribution is being deployed (10-15 minutes)"
print_warning "Add this to GitHub Secrets:"
echo ""
echo "  CLOUDFRONT_DISTRIBUTION_ID=$DISTRIBUTION_ID"
echo ""
print_info "Check deployment status:"
echo "  aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'Distribution.Status'"
echo ""
print_info "Test when ready:"
echo "  curl -I https://$DISTRIBUTION_DOMAIN"
echo ""

# Guardar en .env.local si existe
if [ -f .env.local ]; then
    if ! grep -q "CLOUDFRONT_DISTRIBUTION_ID" .env.local; then
        echo "" >> .env.local
        echo "# CloudFront Configuration" >> .env.local
        echo "CLOUDFRONT_DISTRIBUTION_ID=$DISTRIBUTION_ID" >> .env.local
        print_info "Added CLOUDFRONT_DISTRIBUTION_ID to .env.local"
    fi
fi
