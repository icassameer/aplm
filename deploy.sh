#!/bin/bash
# ─── ICA CRM — Production Deployment Script ──────────────────────────────────
# Run this on your VPS after initial setup
# Usage: chmod +x deploy.sh && ./deploy.sh

set -e  # Exit on any error

echo "🚀 ICA CRM Deployment Starting..."

# ─── 1. Pull latest code ──────────────────────────────────────────────────────
echo "📦 Pulling latest code from GitHub..."
git pull origin main

# ─── 2. Install dependencies ─────────────────────────────────────────────────
echo "📚 Installing dependencies..."
npm install --production=false

# ─── 3. Build frontend ───────────────────────────────────────────────────────
echo "🔨 Building React frontend..."
npm run build

# ─── 4. Create log directory ─────────────────────────────────────────────────
sudo mkdir -p /var/log/ica-crm
sudo chown $USER:$USER /var/log/ica-crm

# ─── 5. Restart app with PM2 ─────────────────────────────────────────────────
echo "🔄 Restarting application..."
pm2 restart ecosystem.config.cjs --env production || pm2 start ecosystem.config.cjs --env production
pm2 save

echo "✅ Deployment complete!"
echo "📊 App status:"
pm2 status
