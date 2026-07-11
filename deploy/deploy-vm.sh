#!/usr/bin/env bash
# VM deployment script for a Breeze application.
#
# Sets up Node.js + the Breeze runtime on any Linux VM, installs your app
# as a systemd service, and starts it. Designed for Ubuntu/Debian but works
# on most Linux distros.
#
# Usage (run on the VM, as root or with sudo):
#   curl -fsSL https://raw.githubusercontent.com/Saff9/Breeze/main/deploy/deploy-vm.sh | bash -s -- myapp
#
# Or clone and run locally:
#   sudo ./deploy-vm.sh myapp /path/to/your/breeze/app
#
# After install:
#   - App runs at http://YOUR_VM_IP:3000
#   - Logs: journalctl -u breeze-myapp -f
#   - Restart: systemctl restart breeze-myapp
#   - Stop: systemctl stop breeze-myapp

set -euo pipefail

APP_NAME="${1:-breeze-app}"
APP_SOURCE="${2:-.}"
APP_DIR="/opt/${APP_NAME}"
SERVICE_NAME="breeze-${APP_NAME}"

if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root (use sudo)." >&2
  exit 1
fi

echo "==> Installing Node.js 20 LTS (if not present)..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "    Node $(node --version) ready."

echo "==> Installing the Breeze runtime globally..."
npm install -g breeze-lang

echo "==> Installing app to ${APP_DIR}..."
mkdir -p "${APP_DIR}"
cp -r "${APP_SOURCE}"/* "${APP_DIR}"/ 2>/dev/null || true
if [[ -f "${APP_DIR}/package.json" ]]; then
  cd "${APP_DIR}" && npm install --omit=dev
fi

# Default entry point
ENTRY="src/main.bz"
if [[ ! -f "${APP_DIR}/${ENTRY}" ]]; then
  echo "    Warning: ${ENTRY} not found. Edit the systemd unit's ExecStart." >&2
fi

echo "==> Creating systemd service ${SERVICE_NAME}..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Breeze application: ${APP_NAME}
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=$(which breeze) run ${ENTRY}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"

echo "==> Done!"
echo "    Service:  ${SERVICE_NAME}"
echo "    Port:     3000"
echo "    Logs:     journalctl -u ${SERVICE_NAME} -f"
echo "    Stop:     systemctl stop ${SERVICE_NAME}"
echo "    Restart:  systemctl restart ${SERVICE_NAME}"
