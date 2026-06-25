#!/bin/bash
# Setup Manuale Staff su Ubuntu (Oracle Cloud Always Free)
# Esegui come root: bash setup-oracle.sh
set -euo pipefail

APP_DIR="/opt/manuale-staff"
APP_USER="ubuntu"
REPO_URL="${REPO_URL:-}"

echo "==> Aggiornamento sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

echo "==> Installazione dipendenze"
apt-get install -y curl git nginx ufw build-essential python3

echo "==> Installazione Node.js 20"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "==> Installazione PM2"
npm install -g pm2

echo "==> Firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> Cartella applicazione"
mkdir -p "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

if [ -n "$REPO_URL" ]; then
  echo "==> Clone repository"
  sudo -u "$APP_USER" git clone "$REPO_URL" "$APP_DIR" || sudo -u "$APP_USER" git -C "$APP_DIR" pull
else
  echo "⚠️  REPO_URL non impostato — carica i file manualmente in $APP_DIR"
fi

if [ ! -f "$APP_DIR/package.json" ]; then
  echo "❌ package.json non trovato in $APP_DIR"
  echo "   Carica il progetto prima di continuare."
  exit 1
fi

echo "==> File .env"
if [ ! -f "$APP_DIR/.env" ]; then
  JWT_SECRET=$(openssl rand -hex 32)
  cat > "$APP_DIR/.env" <<EOF
PORT=4000
NODE_ENV=production
JWT_SECRET=$JWT_SECRET
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$(openssl rand -base64 12 | tr -dc 'A-Za-z0-9' | head -c 14)
ADMIN_NAME=Amministratore
ADMIN_USERNAMES=
EOF
  chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
  echo "✅ .env creato — SALVA LE CREDENZIALI:"
  grep -E '^(ADMIN_USERNAME|ADMIN_PASSWORD)=' "$APP_DIR/.env"
fi

echo "==> npm install + build native"
cd "$APP_DIR"
sudo -u "$APP_USER" npm install --omit=dev

echo "==> PM2"
cp "$APP_DIR/deploy/ecosystem.config.cjs" /etc/pm2-ecosystem.config.cjs 2>/dev/null || true
sudo -u "$APP_USER" pm2 start "$APP_DIR/deploy/ecosystem.config.cjs"
sudo -u "$APP_USER" pm2 save
env PATH=$PATH:/usr/bin pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" | tail -1 | bash

echo "==> Nginx"
cp "$APP_DIR/deploy/nginx-manuale.conf" /etc/nginx/sites-available/manuale-staff
ln -sf /etc/nginx/sites-available/manuale-staff /etc/nginx/sites-enabled/manuale-staff
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
systemctl enable nginx

PUBLIC_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')
echo ""
echo "============================================"
echo "✅ Installazione completata!"
echo "🌐 Sito: http://$PUBLIC_IP"
echo "👑 Credenziali admin in: $APP_DIR/.env"
echo "   cat $APP_DIR/.env | grep ADMIN"
echo "============================================"
