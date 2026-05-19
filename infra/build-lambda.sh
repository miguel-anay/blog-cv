#!/usr/bin/env bash
set -euo pipefail

# Builds blog-api Lambda deployment zip
# Run from infra/ directory: ./build-lambda.sh

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$REPO_ROOT/blog-api"
DIST_DIR="$API_DIR/dist"

echo "→ Building blog-api bundle..."
cd "$API_DIR"
node esbuild.config.mjs

echo "→ Creating deployment zip..."
mkdir -p "$DIST_DIR"
cd "$DIST_DIR"
zip -r handler.zip handler.cjs

echo "✓ Lambda zip ready: $DIST_DIR/handler.zip"
du -sh handler.zip
