#!/bin/bash
# ─── ICA CRM — Fresh VPS Setup Script ────────────────────────────────────────
# Run once on a fresh Ubuntu 22.04/24.04 VPS as root
# Usage: wget -O setup-vps.sh <url> && chmod +x setup-vps.sh && ./setup-vps.sh

set -e
echo "🖥️  ICA CRM VPS Setup Starting..."

# ─── System updates ───────────────────────────────────────────────────────────
apt-get update && apt-get upgrade -y
apt-get install -y curl git unzip ufw nginx certbot python3-certbot-nginx ffmpeg

# ─── Node.js 20 ───────────────────────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
echo "Node: $(node --version)"

# ─── PM2 ─────────────────────────────────────────────────────────────────────
npm install -g pm2

# ─── PostgreSQL ───────────────────────────────────────────────────────────────
apt-get install -y postgresql postgresql-contrib
systemctl start postgresql && systemctl enable postgresql

# ─── Create database ─────────────────────────────────────────────────────────
echo "Creating database..."
sudo -u postgres psql << SQLEOF
CREATE DATABASE ica_crm;
CREATE USER ica_user WITH PASSWORD 'ChangeThisPassword123!';
GRANT ALL PRIVILEGES ON DATABASE ica_crm TO ica_user;
ALTER DATABASE ica_crm OWNER TO ica_user;
SQLEOF

# ─── Firewall ─────────────────────────────────────────────────────────────────
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80
ufw allow 443
ufw --force enable
echo "Firewall configured"

# ─── Log directory ────────────────────────────────────────────────────────────
mkdir -p /var/log/ica-crm

# ─── Clone app ────────────────────────────────────────────────────────────────
mkdir -p /var/www
cd /var/www
git clone https://github.com/icassameer/icacrmweb.in ica-crm
cd ica-crm

echo ""
echo "✅ VPS setup complete!"
echo ""
echo "Next steps:"
echo "  1. Copy .env.example to .env and fill in your values:"
echo "     cp .env.example .env && nano .env"
echo ""
echo "  2. Install dependencies and build:"
echo "     npm install && npm run build"
echo ""
echo "  3. Start the app:"
echo "     pm2 start ecosystem.config.cjs --env production"
echo "     pm2 save && pm2 startup"
echo ""
echo "  4. Setup Nginx:"
echo "     cp nginx.conf /etc/nginx/sites-available/ica-crm"
echo "     ln -s /etc/nginx/sites-available/ica-crm /etc/nginx/sites-enabled/"
echo "     nginx -t && systemctl reload nginx"
echo ""
echo "  5. Get SSL certificate:"
echo "     certbot --nginx -d crm.icaweb.in"
