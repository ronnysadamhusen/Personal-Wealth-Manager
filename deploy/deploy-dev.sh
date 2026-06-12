#!/bin/bash
# =============================================================================
# Deploy Dev Environment ke LXC 113 (192.168.100.223 atau sesuaikan)
# Jalankan dari local machine atau langsung di LXC 113
#
# Branch yang di-deploy: feature/category-transaction-count
# Port dev: 3002
# =============================================================================

set -e

REPO_URL="https://github.com/ronnysadamhusen/Personal-Wealth-Manager.git"
BRANCH="feature/category-transaction-count"
APP_DIR="/opt/personal-wealth-manager-dev"

echo "=== Deploy Dev: $BRANCH ==="

# Install docker jika belum ada
if ! command -v docker &> /dev/null; then
  echo "Installing Docker..."
  apt-get update -qq
  apt-get install -y docker.io docker-compose-plugin
  systemctl enable docker --now
fi

# Clone atau update repo
if [ -d "$APP_DIR/.git" ]; then
  echo "Updating repo..."
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull origin "$BRANCH"
else
  echo "Cloning repo..."
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

# Buat folder data dev agar tidak konflik dengan production
mkdir -p "$APP_DIR/data-dev"

# Rebuild dan restart container dev
echo "Building & starting dev container..."
docker compose -f docker-compose.dev.yml down 2>/dev/null || true
docker compose -f docker-compose.dev.yml build --no-cache
docker compose -f docker-compose.dev.yml up -d

echo ""
echo "✅ Dev environment berjalan!"
echo "   URL: http://$(hostname -I | awk '{print $1}'):3002"
echo ""
docker compose -f docker-compose.dev.yml ps
