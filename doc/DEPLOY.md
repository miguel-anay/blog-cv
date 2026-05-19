# Deploy — S3 + CloudFront

Guía completa para desplegar el sitio Astro en AWS S3 + CloudFront.

## Quick Start (15 min)

### Pre-requisitos

- [ ] Cuenta AWS activa
- [ ] AWS CLI instalado y configurado (`aws configure`)
- [ ] Repositorio en GitHub
- [ ] Node.js 20+ instalado
- [ ] `jq` instalado: `brew install jq` o `apt-get install jq`

### Método Automatizado (Recomendado)

```bash
# 1. Configurar AWS CLI si aún no lo has hecho
aws configure

# 2. Crear S3 Bucket (NO habilitar public access, CloudFront lo manejará)
aws s3 mb s3://blog-miguel-anay-nom-pe --region us-east-1

# 3. Ejecutar script de setup CloudFront (crea OAI, bucket policy y distribution)
chmod +x scripts/setup-cloudfront.sh
./scripts/setup-cloudfront.sh blog-miguel-anay-nom-pe us-east-1

# 4. Output esperado:
# Distribution ID: E1ABCDEFGHIJK
# CloudFront URL: https://d111111abcdef8.cloudfront.net
# Status: InProgress (desplegado en ~10-15 minutos)
```

Guarda el `Distribution ID` — lo necesitarás para GitHub Secrets y los comandos de invalidación.

### Configurar GitHub Secrets

Ve a: `Repositorio > Settings > Secrets and variables > Actions`

| Secret | Valor | Requerido |
|--------|-------|-----------|
| `AWS_ACCESS_KEY_ID` | Tu Access Key | ✅ |
| `AWS_SECRET_ACCESS_KEY` | Tu Secret Key | ✅ |
| `AWS_REGION` | `us-east-1` | ✅ |
| `S3_BUCKET_NAME` | `blog-miguel-anay-nom-pe` | ✅ |
| `CLOUDFRONT_DISTRIBUTION_ID` | `E1ABCDEFGHIJK` | ✅ |
| `PUBLIC_STRAPI_URL` | Tu URL de Strapi | Opcional |
| `STRAPI_API_TOKEN` | Token de API de Strapi | Opcional |

### Primer Despliegue

```bash
git add .
git commit -m "ci: add CloudFront CI/CD"
git push origin main
# Monitorear en: Repositorio > Actions
```

---

## Setup Manual Completo

### 1. S3 Bucket

#### 1.1 Crear el bucket

```bash
aws s3 mb s3://blog-miguel-anay-nom-pe --region us-east-1

# Verificar creación
aws s3 ls | grep blog-miguel-anay
```

> **Nota:** Con CloudFront como CDN, NO es necesario habilitar website hosting ni acceso público en S3. CloudFront accede al bucket mediante Origin Access Identity (OAI).

#### 1.2 Si usas S3 website hosting directo (sin CloudFront)

```bash
aws s3 website s3://blog-miguel-anay-nom-pe --index-document index.html --error-document 404.html
```

Habilitar acceso público y política del bucket:

```bash
aws s3api put-public-access-block \
  --bucket blog-miguel-anay-nom-pe \
  --public-access-block-configuration \
  "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"
```

Crear `bucket-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::blog-miguel-anay-nom-pe/*"
    }
  ]
}
```

```bash
aws s3api put-bucket-policy --bucket blog-miguel-anay-nom-pe --policy file://bucket-policy.json
```

### 2. IAM Usuario

#### 2.1 Crear usuario

```bash
aws iam create-user --user-name blog-miguel-anay-deployer
```

#### 2.2 Crear política de permisos

Crea `aws-config-examples/iam-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::blog-miguel-anay-nom-pe",
        "arn:aws:s3:::blog-miguel-anay-nom-pe/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation"
      ],
      "Resource": "*"
    }
  ]
}
```

```bash
aws iam create-policy \
  --policy-name BlogMiguelAnayDeployPolicy \
  --policy-document file://aws-config-examples/iam-policy.json

# Adjuntar política (reemplaza YOUR-ACCOUNT-ID)
aws iam attach-user-policy \
  --user-name blog-miguel-anay-deployer \
  --policy-arn arn:aws:iam::YOUR-ACCOUNT-ID:policy/BlogMiguelAnayDeployPolicy
```

#### 2.3 Crear access keys

```bash
aws iam create-access-key --user-name blog-miguel-anay-deployer
```

**IMPORTANTE:** Guarda las credenciales de forma segura:

```json
{
  "AccessKeyId": "AKIAIOSFODNN7EXAMPLE",
  "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCY..."
}
```

### 3. CloudFront Distribution

#### 3.1 Origin Access Identity (OAI)

```bash
aws cloudfront create-cloud-front-origin-access-identity \
  --cloud-front-origin-access-identity-config \
  "CallerReference=$(date +%s),Comment=OAI for blog-miguel-anay-nom-pe"

# Guardar el ID y S3CanonicalUserId del output
```

#### 3.2 Bucket Policy para CloudFront

Crea `bucket-policy-cloudfront.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudFrontOAI",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity YOUR-OAI-ID"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::blog-miguel-anay-nom-pe/*"
    }
  ]
}
```

```bash
aws s3api put-bucket-policy \
  --bucket blog-miguel-anay-nom-pe \
  --policy file://bucket-policy-cloudfront.json
```

#### 3.3 Crear CloudFront Distribution

Crea `cloudfront-config.json`:

```json
{
  "CallerReference": "astro-site-1234567890",
  "Comment": "Astro Site CDN",
  "Enabled": true,
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-blog-miguel-anay-nom-pe",
        "DomainName": "blog-miguel-anay-nom-pe.s3.us-east-1.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": "origin-access-identity/cloudfront/YOUR-OAI-ID"
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-blog-miguel-anay-nom-pe",
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
```

```bash
aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json
```

### 4. Custom Domain + SSL (ACM)

**IMPORTANTE:** El certificado DEBE estar en `us-east-1` para CloudFront.

#### 4.1 Solicitar certificado SSL

```bash
aws acm request-certificate \
  --domain-name blog.miguel-anay.nom.pe \
  --validation-method DNS \
  --region us-east-1

# Obtener ARN del certificado
CERT_ARN=$(aws acm list-certificates --region us-east-1 \
  --query 'CertificateSummaryList[?DomainName==`blog.miguel-anay.nom.pe`].CertificateArn' \
  --output text)

echo "Certificate ARN: $CERT_ARN"

# Ver registros DNS de validación
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord'
```

#### 4.2 Validar el certificado

Agrega el registro CNAME que AWS proporciona en tu proveedor DNS:

```
Type: CNAME
Name: _abc123def456.blog.miguel-anay.nom.pe
Value: _xyz789.acm-validations.aws.
TTL: 300
```

Espera 5-30 minutos. Verificar estado:

```bash
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region us-east-1 \
  --query 'Certificate.Status'
# Debe mostrar: "ISSUED"
```

#### 4.3 Agregar dominio a CloudFront

```bash
DIST_ID=E1ABCDEFGHIJK

# Obtener configuración actual
aws cloudfront get-distribution-config --id $DIST_ID > cloudfront-current.json

# Extraer ETag
ETAG=$(cat cloudfront-current.json | jq -r '.ETag')

# Extraer configuración
cat cloudfront-current.json | jq '.DistributionConfig' > cloudfront-config.json
```

Edita `cloudfront-config.json` y agrega/modifica:

```json
{
  "Aliases": {
    "Quantity": 1,
    "Items": ["blog.miguel-anay.nom.pe"]
  },
  "ViewerCertificate": {
    "ACMCertificateArn": "arn:aws:acm:us-east-1:123456789:certificate/abc-def-123",
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021",
    "Certificate": "arn:aws:acm:us-east-1:123456789:certificate/abc-def-123",
    "CertificateSource": "acm"
  }
}
```

```bash
aws cloudfront update-distribution \
  --id $DIST_ID \
  --distribution-config file://cloudfront-config.json \
  --if-match $ETAG
```

### 5. DNS Configuration

#### Opción A: Route 53 (Recomendado con AWS)

```bash
# Crear hosted zone
aws route53 create-hosted-zone --name miguel-anay.nom.pe --caller-reference $(date +%s)

# Crear Alias record
cat > route53-record.json <<EOF
{
  "Changes": [
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "blog.miguel-anay.nom.pe",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "d111111abcdef8.cloudfront.net",
          "EvaluateTargetHealth": false
        }
      }
    }
  ]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR-ZONE-ID \
  --change-batch file://route53-record.json
```

> **Nota:** `Z2FDTNDATAQYW2` es el Hosted Zone ID global de CloudFront (constante).

#### Opción B: Otro proveedor DNS (Cloudflare, etc.)

```
Type: CNAME
Name: blog
Value: d111111abcdef8.cloudfront.net  (tu CloudFront domain)
TTL: 300
```

Para obtener tu CloudFront domain:

```bash
aws cloudfront get-distribution \
  --id $DIST_ID \
  --query 'Distribution.DomainName' \
  --output text
```

> Si usas CloudFront, configura el registro DNS como **DNS only (gris)** en Cloudflare — CloudFront ya es un CDN y no necesita el proxy de Cloudflare.

---

## GitHub Secrets

Tabla unificada de todos los secrets necesarios:

### Producción

| Secret Name | Descripción | Ejemplo |
|-------------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | Access Key ID del usuario IAM | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | Secret Access Key | `wJalrXUtnFEMI/K7MDENG/...` |
| `AWS_REGION` | Región de AWS | `us-east-1` |
| `S3_BUCKET_NAME` | Nombre del bucket S3 | `blog-miguel-anay-nom-pe` |
| `CLOUDFRONT_DISTRIBUTION_ID` | ID de distribución CloudFront | `E1ABCDEFGHIJK` |
| `PUBLIC_STRAPI_URL` | URL de la API Strapi | `https://api.tu-dominio.com` |
| `STRAPI_API_TOKEN` | Token de autenticación Strapi | (desde Settings > API Tokens) |

### Staging (Opcional)

| Secret Name | Descripción |
|-------------|-------------|
| `STAGING_STRAPI_URL` | URL de Strapi staging |
| `STAGING_STRAPI_API_TOKEN` | Token Strapi staging |
| `STAGING_S3_BUCKET_NAME` | Bucket S3 de staging |
| `STAGING_CLOUDFRONT_DISTRIBUTION_ID` | Distribution ID staging |

---

## Cache Strategy

El workflow implementa una estrategia de cache optimizada para máximo rendimiento:

### Assets Estáticos (JS, CSS, imágenes)

```
Cache-Control: public, max-age=31536000, immutable
CloudFront: DefaultTTL=86400, MaxTTL=31536000
```

Cached por 1 año. Astro genera nombres de archivo con hash para cache busting automático.

### HTML / XML / TXT Files

```
Cache-Control: public, max-age=0, must-revalidate
CloudFront: MinTTL=0
```

Siempre revalida con el servidor — los usuarios siempre reciben el contenido más reciente.

### Custom Error Pages

- `403` → redirect a `/index.html` con código `200` (SPA routing)
- `404` → muestra `/404.html`

---

## Comandos Útiles

### Build y Deploy

```bash
# Build local
npm run build

# Preview local
npm run preview

# Deploy completo (build + upload a S3 + invalidación)
npm run deploy:prod

# Solo sync a S3 sin el script
aws s3 sync dist/ s3://blog-miguel-anay-nom-pe --delete

# Deploy manual con cache headers
aws s3 sync dist/ s3://blog-miguel-anay-nom-pe \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "*.html" --exclude "*.xml" --exclude "*.txt"

aws s3 sync dist/ s3://blog-miguel-anay-nom-pe \
  --cache-control "public, max-age=0, must-revalidate" \
  --include "*.html" --include "*.xml" --include "*.txt"
```

### CloudFront

```bash
# Invalidar todo el caché
aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/*"

# Invalidar paths específicos
aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/index.html" "/blog/*"

# Ver estado de invalidación
aws cloudfront get-invalidation \
  --distribution-id $DIST_ID \
  --id INVALIDATION-ID

# Ver invalidaciones activas
aws cloudfront list-invalidations --distribution-id $DIST_ID

# Ver estado de la distribution
aws cloudfront get-distribution --id $DIST_ID \
  --query 'Distribution.Status'

# Listar todas las distributions
aws cloudfront list-distributions
```

### S3

```bash
# Ver archivos en el bucket
aws s3 ls s3://blog-miguel-anay-nom-pe/ --recursive | head -20

# Ver tamaño del bucket
aws s3 ls s3://blog-miguel-anay-nom-pe --recursive --summarize

# Verificar que el sitio esté accesible
curl -I https://blog.miguel-anay.nom.pe
```

### Verificación DNS

```bash
nslookup blog.miguel-anay.nom.pe
nslookup d111111abcdef8.cloudfront.net
```

---

## Troubleshooting

### Error: CloudFront devuelve 403 Forbidden

**Causa:** OAI no configurado correctamente o bucket policy incorrecta.

**Diagnóstico:**
```bash
aws s3api get-bucket-policy --bucket blog-miguel-anay-nom-pe
# Verificar que incluya el OAI correcto en el Principal
```

**Solución:**
- Verifica que la bucket policy incluya el ARN del OAI
- Si es necesario, ejecuta el setup script nuevamente:
  ```bash
  ./scripts/setup-cloudfront.sh blog-miguel-anay-nom-pe us-east-1
  ```
- Si es S3 website hosting directo (sin CloudFront), verifica que el acceso público esté habilitado

### Error: SSL Certificate no funciona

**Causa:** Certificado no validado o creado en región incorrecta.

**Diagnóstico:**
```bash
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region us-east-1 \
  --query 'Certificate.Status'
# Debe decir "ISSUED"
```

**Solución:**
- Si dice `PENDING_VALIDATION`, verifica que los registros CNAME de validación estén en tu DNS
- El certificado DEBE estar en `us-east-1` para CloudFront — en cualquier otra región no funcionará

### Cambios no se reflejan en el sitio

**Causa:** Caché de CloudFront.

**Solución:**
```bash
aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/*"
# Esperar 1-5 minutos
```

### Error: Dominio no resuelve

**Causa:** DNS no propagado (puede tardar hasta 48 horas, usualmente 1-2 horas).

**Diagnóstico:**
```bash
nslookup blog.miguel-anay.nom.pe
```

### Error: Invalidation Failed

**Causa:** Permisos IAM insuficientes.

**Solución:** Verifica que la política IAM incluya:
```json
{
  "Effect": "Allow",
  "Action": [
    "cloudfront:CreateInvalidation",
    "cloudfront:GetInvalidation"
  ],
  "Resource": "*"
}
```

### GitHub Actions falla en el build

- Revisa los logs en la pestaña Actions
- Verifica que todas las dependencias estén en `package.json`
- Confirma que Node.js version sea 20.x
- Confirma que los secrets estén configurados correctamente

---

## Costos estimados

**Para blog.miguel-anay.nom.pe (estimación conservadora):**

| Componente | 10 GB/mes | 100 GB/mes | 1 TB/mes |
|------------|-----------|------------|----------|
| S3 Storage (500 MB) | $0.01 | $0.12 | $1.20 |
| S3 Requests | $0.02 | $0.40 | $4.00 |
| CloudFront Transfer | $0.85 | $8.50 | $85.00 |
| CloudFront Requests (50k) | $0.05 | $0.50 | $5.00 |
| **Total estimado** | **~$0.93/mes** | **~$9.52/mes** | **~$95/mes** |

**Incluye gratis:**
- SSL/TLS certificate (ACM)
- CDN global (400+ puntos de presencia)
- DDoS protection (AWS Shield Standard)
- Compresión automática (Gzip/Brotli)
- 1,000 invalidaciones/mes

**URLs importantes:**
- Sitio en producción: https://blog.miguel-anay.nom.pe
- AWS Console CloudFront: https://console.aws.amazon.com/cloudfront
- AWS Console S3: https://console.aws.amazon.com/s3
- Google Search Console: https://search.google.com/search-console

---

## Checklist de Deployment

- [ ] AWS CLI configurado
- [ ] Usuario IAM creado con permisos
- [ ] S3 bucket creado: `blog-miguel-anay-nom-pe`
- [ ] CloudFront distribution creada
- [ ] Certificado SSL solicitado en ACM (us-east-1)
- [ ] Certificado validado via DNS
- [ ] CloudFront configurado con dominio personalizado
- [ ] Registro DNS CNAME agregado
- [ ] Archivo `.env` configurado localmente
- [ ] Primer deployment exitoso
- [ ] Sitio accesible en https://blog.miguel-anay.nom.pe
- [ ] GitHub Secrets configurados
- [ ] Sitemap enviado a Google Search Console

---

## Recursos Adicionales

- [CloudFront Developer Guide](https://docs.aws.amazon.com/cloudfront/)
- [S3 Static Website Hosting](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)
- [AWS Certificate Manager](https://docs.aws.amazon.com/acm/)
- [Astro Deployment Guides](https://docs.astro.build/en/guides/deploy/)
- [AWS CLI Reference](https://awscli.amazonaws.com/v2/documentation/api/latest/index.html)
