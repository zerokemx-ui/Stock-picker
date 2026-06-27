#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${STOCK_PICKER_REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BRANCH="${STOCK_PICKER_BRANCH:-main}"
WEB_DIR="${STOCK_PICKER_WEB_DIR:-/share/Projects/saas/apps/stock-picker-web}"
PUSH_DATA="${STOCK_PICKER_PUSH_DATA:-0}"

cd "$REPO_DIR"

echo "[$(date -Is)] Updating Stock-picker in $REPO_DIR"
echo "[$(date -Is)] Web output directory: $WEB_DIR"

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

if [ ! -d node_modules ]; then
  npm ci
elif [ package-lock.json -nt node_modules ]; then
  npm ci
fi

npm run build:data
npm run validate:data
npm run build:app

if [ -z "$WEB_DIR" ] || [ "$WEB_DIR" = "/" ]; then
  echo "Refusing to deploy to unsafe WEB_DIR: $WEB_DIR" >&2
  exit 1
fi

mkdir -p "$WEB_DIR"

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete dist/ "$WEB_DIR"/
else
  find "$WEB_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  cp -R dist/. "$WEB_DIR"/
fi

echo "[$(date -Is)] Static site deployed to $WEB_DIR"

if [ "$PUSH_DATA" != "1" ]; then
  echo "[$(date -Is)] STOCK_PICKER_PUSH_DATA is not 1; skipping git commit/push."
  exit 0
fi

if git diff --quiet -- public/api; then
  echo "[$(date -Is)] No public/api changes to commit."
  exit 0
fi

git add public/api
git commit -m "data: refresh stock snapshot $(date '+%Y-%m-%d %H:%M %Z')"
git push origin "$BRANCH"

echo "[$(date -Is)] Data refresh pushed to GitHub."
