#!/bin/bash
# deploy-dev.sh — Deploy branch ke LXC 113 (dev) dengan sinkronisasi DB dari production.
# Jalankan dari LXC 113: bash /opt/personal-wealth-manager-dev/scripts/deploy-dev.sh [branch]
# Contoh: bash /opt/personal-wealth-manager-dev/scripts/deploy-dev.sh feature/my-branch

set -e

DEPLOY_DIR="/opt/personal-wealth-manager-dev"
PROD_DB="root@192.168.100.222:/opt/personal-wealth-manager/data/database.sqlite"
DEV_DB="$DEPLOY_DIR/data-dev/database.sqlite"
BRANCH="${1:-$(cd $DEPLOY_DIR && git rev-parse --abbrev-ref HEAD)}"

echo "=========================================="
echo " Deploy Dev — branch: $BRANCH"
echo "=========================================="

cd "$DEPLOY_DIR"

echo ""
echo "--- [1/5] Pull latest code ---"
git fetch origin
git checkout "$BRANCH"
git pull

echo ""
echo "--- [2/5] Stop container ---"
docker compose -f docker-compose.dev.yml down

echo ""
echo "--- [3/5] Sync DB dari production (LXC 112) ---"
scp "$PROD_DB" "$DEV_DB"
echo "DB synced: prod → dev"

echo ""
echo "--- [4/5] Build image ---"
docker compose -f docker-compose.dev.yml build --no-cache

echo ""
echo "--- [5/5] Start container ---"
docker compose -f docker-compose.dev.yml up -d

echo ""
echo "--- Status ---"
docker compose -f docker-compose.dev.yml ps
echo ""
echo "Deploy selesai. Dev: http://192.168.100.223:3001"
