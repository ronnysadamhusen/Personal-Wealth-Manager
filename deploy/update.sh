#!/bin/bash
# =============================================================================
# Personal Wealth Manager — Update Script
# Jalankan di LXC untuk update ke versi terbaru dari GitHub
# =============================================================================

set -e

APP_DIR="/opt/personal-wealth-manager"

echo "Pulling latest changes from GitHub..."
git -C "$APP_DIR" pull

echo "Rebuilding and restarting container..."
cd "$APP_DIR"
docker compose down
docker compose build --no-cache
docker compose up -d

echo ""
echo "✅ Update selesai! Aplikasi sudah berjalan dengan versi terbaru."
docker compose ps
