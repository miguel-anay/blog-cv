#!/usr/bin/env bash
set -euo pipefail

# Builds the Astro SSR Lambda deployment zip.
# Must be run AFTER `pnpm build` (which creates dist/server/ and dist/client/).
# Uses esbuild to produce a single bundled handler.mjs — no node_modules/ needed.
# Run from repo root: bash infra/build-ssr.sh

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$REPO_ROOT/dist"
ESBUILD="$REPO_ROOT/node_modules/.bin/esbuild"

if [ ! -d "$DIST_DIR/server" ]; then
  echo "ERROR: dist/server/ not found. Run 'pnpm build' first." >&2
  exit 1
fi

echo "→ Writing Lambda entry point..."
# Written inside dist/ so relative imports (./server/entry.mjs) resolve correctly
cat > "$DIST_DIR/_lambda-entry.mjs" << 'EOF'
import serverless from 'serverless-http';
import { handler as middleware } from './server/entry.mjs';
const app = (req, res) => middleware(req, res, () => { res.statusCode = 404; res.end(''); });
export const handler = serverless(app);
EOF

echo "→ Bundling with esbuild (all deps inlined, single file)..."
cd "$DIST_DIR"
"$ESBUILD" _lambda-entry.mjs \
  --bundle \
  --platform=node \
  --target=node22 \
  --format=esm \
  --outfile=handler.mjs \
  '--banner:js=import { createRequire } from "module"; const require = createRequire(import.meta.url);' \
  --external:sharp \
  --external:fsevents \
  --log-level=warning

rm _lambda-entry.mjs

echo "→ Creating ssr.zip (handler only)..."
zip -qr ssr.zip handler.mjs
rm handler.mjs

cd "$REPO_ROOT"
echo "✓ SSR Lambda zip: dist/ssr.zip ($(du -sh dist/ssr.zip | cut -f1))"
