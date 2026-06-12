#!/bin/bash
# =============================================================================
# Install GitHub Actions Self-Hosted Runner di LXC 112
# Jalankan sebagai root di LXC 112 (192.168.100.222)
#
# Sebelum menjalankan script ini:
# 1. Buka GitHub repo: https://github.com/ronnysadamhusen/Personal-Wealth-Manager
# 2. Settings → Actions → Runners → New self-hosted runner
# 3. Pilih Linux x64 → salin nilai RUNNER_TOKEN dari halaman tersebut
# 4. Set variabel di bawah sebelum menjalankan script
# =============================================================================

set -e

GITHUB_REPO="ronnysadamhusen/Personal-Wealth-Manager"
RUNNER_TOKEN=""        # ← ISI dari GitHub Settings → Actions → Runners → New runner
RUNNER_VERSION="2.317.0"
RUNNER_DIR="/opt/actions-runner"
APP_DIR="/opt/personal-wealth-manager"

# --- Validasi token ---
if [ -z "$RUNNER_TOKEN" ]; then
  echo "❌ RUNNER_TOKEN belum diisi. Edit script ini dan isi RUNNER_TOKEN terlebih dahulu."
  exit 1
fi

echo "=== 1. Pastikan dependensi tersedia ==="
apt-get update -qq
apt-get install -y curl git docker.io docker-compose-plugin libicu-dev

# Aktifkan Docker service
systemctl enable docker --now

echo "=== 2. Clone / update repo aplikasi ==="
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull origin master
else
  git clone https://github.com/${GITHUB_REPO}.git "$APP_DIR"
fi

echo "=== 3. Download GitHub Actions runner ==="
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

curl -fsSL \
  "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" \
  -o runner.tar.gz

tar xzf runner.tar.gz
rm runner.tar.gz

echo "=== 4. Konfigurasi runner ==="
./config.sh \
  --url "https://github.com/${GITHUB_REPO}" \
  --token "$RUNNER_TOKEN" \
  --name "lxc-112-production" \
  --labels "self-hosted,production" \
  --work "$RUNNER_DIR/_work" \
  --unattended \
  --replace

echo "=== 5. Install sebagai systemd service ==="
./svc.sh install root
./svc.sh start

echo ""
echo "✅ Runner berhasil diinstall dan berjalan!"
echo ""
echo "Status runner:"
./svc.sh status

echo ""
echo "Cek di GitHub: https://github.com/${GITHUB_REPO}/settings/actions/runners"
