# CI/CD Setup Documentation

This document describes the Continuous Integration and Continuous Deployment (CI/CD) pipeline for the Callous Cluster Astro blog project.

## Overview

The project uses **GitHub Actions** for automated testing, building, and deployment:

- **Production** - Main branch deployments (`deploy.yml`)
- **CI checks** - Lint, type-check, and build validation (`ci.yml`)

## Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Triggers:**

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

**Jobs:**

#### Lint and Type Check

- Runs Astro check (`npx astro check`)
- Runs TypeScript type checking (`npx tsc --noEmit`)
- Both steps continue on error (won't block builds)

#### Build

- Builds the Astro site
- Uploads build artifacts (retained for 7 days)
- Depends on successful lint/typecheck

#### Security Scan

- Runs `npm audit` to check for vulnerabilities
- Runs independently in parallel

**Purpose:** Ensures code quality and catches issues early before deployment.

---

### 2. Production Deployment (`.github/workflows/deploy.yml`)

**Triggers:**

- Push to `main` branch
- Manual workflow dispatch

**Environment:** `production`

**Steps:**

1. Checkout code
2. Setup Node.js 20 with npm cache
3. Install dependencies (`npm ci`)
4. Build Astro site with production environment variables
5. Configure AWS credentials
6. Sync to S3 production bucket with cache optimization
7. Invalidate CloudFront cache
8. Generate deployment summary

**Required Secrets:**

- `PUBLIC_STRAPI_URL` - Strapi backend URL
- `STRAPI_API_TOKEN` - Strapi API authentication token
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `AWS_REGION` - AWS region (e.g., us-east-1)
- `S3_BUCKET_NAME` - Production S3 bucket name
- `CLOUDFRONT_DISTRIBUTION_ID` - CloudFront distribution ID

---

## Environment Setup

### GitHub Repository Secrets

Configure these secrets in your GitHub repository settings:

#### Production Secrets

```
PUBLIC_STRAPI_URL=https://your-production-strapi.com
STRAPI_API_TOKEN=your-strapi-api-token-here
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-production-bucket
CLOUDFRONT_DISTRIBUTION_ID=E1XXXXXXXXXXXXX
```

#### How to Get Strapi API Token

1. Go to your Strapi admin panel
2. Navigate to Settings > API Tokens
3. Create a new API Token with "Read-only" or "Full access" permissions
4. Copy the generated token
5. Add it to GitHub Secrets as `STRAPI_API_TOKEN`

### GitHub Environments

Create the **production** environment in GitHub Settings > Environments:
- Add protection rules (require approval, restrict branches to `main`)
- Add the production secrets listed above

---

## NPM Scripts

New scripts added to `package.json`:

```json
{
  "scripts": {
    "check": "astro check", // Run Astro checks
    "type-check": "tsc --noEmit", // TypeScript type checking
    "test": "echo \"No tests configured yet\" && exit 0",
    "lint": "npm run check", // Alias for check
    "validate": "npm run type-check && npm run build" // Full validation
  }
}
```

**Usage:**

```bash
npm run check       # Run Astro checks
npm run type-check  # Check TypeScript types
npm run validate    # Full validation before commit
npm run build       # Build production site
```

---

## Deployment Flow

### Production Deployment

1. Merge PR to `main` branch
2. CI workflow runs (lint, type-check, build, security scan)
3. Production deployment workflow triggers automatically
4. Site builds with production environment variables
5. Uploads to S3 production bucket
6. Invalidates CloudFront cache
7. Site is live at production URL

---

## Cache Strategy

### S3 Cache Headers

**Static Assets** (JS, CSS, images):

```
Cache-Control: public, max-age=31536000, immutable
```

- Cached for 1 year
- Immutable (won't change)
- Astro handles cache-busting with hashed filenames

**HTML/XML/TXT Files**:

```
Cache-Control: public, max-age=0, must-revalidate
```

- Always revalidate with server
- Ensures users get latest content

---

## Monitoring & Debugging

### View Workflow Runs

1. Go to GitHub repository
2. Click "Actions" tab
3. Select workflow to view runs
4. Click on specific run to see logs

### Deployment Summary

Each deployment creates a summary with:

- CloudFront domain URL
- S3 bucket name
- AWS region
- Commit SHA
- Branch name
- Deployer username

### Troubleshooting

**Build fails on CI but works locally:**

- Check environment variables are set correctly
- Verify Node.js version matches (20.x)
- Check for missing dependencies in `package.json`

**Deployment succeeds but changes not visible:**

- CloudFront cache may take a few minutes to invalidate
- Check CloudFront invalidation status in AWS Console
- Verify correct distribution ID is configured

**Security scan fails:**

- Review `npm audit` output
- Update vulnerable dependencies
- Add `npm audit fix` to workflow if needed

---

## Future Enhancements

### Potential Improvements

1. **Add E2E Testing**

   - Integrate Playwright or Cypress
   - Run tests in CI before deployment

2. **Lighthouse CI**

   - Automated performance testing
   - Block deployments if performance degrades

3. **Preview Deployments**

   - Deploy PR previews to unique URLs
   - Integrate with Netlify Deploy Previews or Vercel

4. **Automated Dependency Updates**

   - Dependabot configuration
   - Automated PR creation for updates

5. **Slack/Discord Notifications**

   - Notify team on deployment success/failure
   - Integration with communication tools

6. **Rollback Strategy**
   - Tag successful deployments
   - Quick rollback to previous version

---

## Best Practices

1. **Use pull requests** for all changes to trigger CI checks
2. **Keep secrets secure** - never commit secrets to the repository
3. **Monitor deployment logs** to catch issues early
4. **Review security scan results** regularly

---

## Support

For issues with CI/CD:

1. Check workflow logs in GitHub Actions
2. Verify all required secrets are configured
3. Review AWS CloudWatch logs for deployment issues
4. Check CloudFront distribution settings

For questions or improvements, create an issue in the repository.
