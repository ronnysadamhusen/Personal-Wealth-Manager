#!/bin/bash
# =============================================================================
# Personal Wealth Manager — LXC Setup Script
# Jalankan script ini di dalam LXC container (Ubuntu 22.04 / Debian 12)
# =============================================================================

set -e

APP_DIR="/opt/personal-wealth-manager"
DATA_DIR="/opt/personal-wealth-manager/data"
GITHUB_REPO="https://github.com/ronnysadamhusen/Personal-Wealth-Manager.git"
PORT=3001

echo "============================================"
echo "  Personal Wealth Manager — LXC Deployment"
echo "============================================"

# ── 1. Update system ──────────────────────────────────────────────────────────
echo "[1/6] Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Install Docker ─────────────────────────────────────────────────────────
echo "[2/6] Installing Docker..."
if ! command -v docker &>/dev/null; then
  apt-get install -y -qq ca-certificates curl gnupg lsb-release git
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable docker
  systemctl start docker
  echo "Docker installed successfully."
else
  echo "Docker already installed, skipping."
fi

# ── 3. Clone / update repository ─────────────────────────────────────────────
echo "[3/6] Setting up application directory..."
if [ -d "$APP_DIR/.git" ]; then
  echo "Repository exists — pulling latest changes..."
  git -C "$APP_DIR" pull
else
  git clone "$GITHUB_REPO" "$APP_DIR"
fi

mkdir -p "$DATA_DIR"
chmod 755 "$DATA_DIR"

# ── 4. Build Docker image ─────────────────────────────────────────────────────
echo "[4/6] Building Docker image (this may take a few minutes)..."
cd "$APP_DIR"
docker compose build --no-cache

# ── 5. Start container ────────────────────────────────────────────────────────
echo "[5/6] Starting container..."
docker compose down --remove-orphans 2>/dev/null || true
docker compose up -d

# ── 6. Setup systemd service for auto-start ───────────────────────────────────
echo "[6/6] Configuring auto-start on boot..."
cat > /etc/systemd/system/personal-wealth-manager.service << EOF
[Unit]
Description=Personal Wealth Manager
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable personal-wealth-manager.service

# ── Done ──────────────────────────────────────────────────────────────────────
LXC_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "============================================"
echo "  ✅ Deployment selesai!"
echo "============================================"
echo "  URL: http://${LXC_IP}:${PORT}"
echo ""
echo "  Perintah berguna:"
echo "  • Lihat log  : docker compose -f ${APP_DIR}/docker-compose.yml logs -f"
echo "  • Restart    : docker compose -f ${APP_DIR}/docker-compose.yml restart"
echo "  • Update app : cd ${APP_DIR} && git pull && docker compose up -d --build"
echo "============================================"
