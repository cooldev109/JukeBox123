#!/bin/bash
# ============================================
# JukeBox VPS Deployment Script
# Target: Ubuntu VPS with Node.js + PostgreSQL
# ============================================

set -e

echo "=========================================="
echo "  JukeBox — VPS Deployment"
echo "=========================================="

# ============================================
# STEP 1: System update & install PM2 + Nginx
# ============================================
echo ""
echo "[1/8] Installing PM2 and Nginx..."
npm install -g pm2
apt install -y nginx
echo "Done."

# ============================================
# STEP 2: Clone the repository
# ============================================
echo ""
echo "[2/8] Cloning repository..."
cd /root
if [ -d "JukeBox" ]; then
  echo "JukeBox directory exists, pulling latest..."
  cd JukeBox
  git pull origin main
else
  git clone https://github.com/cooldev109/JukeBox123.git JukeBox
  cd JukeBox
fi
echo "Done."

# ============================================
# STEP 3: Install dependencies
# ============================================
echo ""
echo "[3/8] Installing dependencies..."
npm install
echo "Done."

# ============================================
# STEP 4: Setup PostgreSQL database
# ============================================
echo ""
echo "[4/8] Setting up PostgreSQL database..."

# Create database and user (ignore errors if already exist)
sudo -u postgres psql -c "CREATE USER jukebox WITH PASSWORD 'JukeBox2026Secure!';" 2>/dev/null || echo "User already exists"
sudo -u postgres psql -c "CREATE DATABASE jukebox1 OWNER jukebox;" 2>/dev/null || echo "Database already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE jukebox1 TO jukebox;" 2>/dev/null || true
echo "Done."

# ============================================
# STEP 5: Create .env file for API
# ============================================
echo ""
echo "[5/8] Creating environment config..."
cat > /root/JukeBox/apps/api/.env << 'ENVEOF'
# Database
DATABASE_URL="postgresql://jukebox:JukeBox2026Secure!@localhost:5432/jukebox1"

# JWT
JWT_SECRET="jb-prod-jwt-secret-change-this-to-random-string"
JWT_REFRESH_SECRET="jb-prod-refresh-secret-change-this-to-random-string"

# Server
PORT=3002
NODE_ENV=production
CORS_ORIGIN=http://45.55.220.142

# Pix Payment Gateway (placeholder — replace with real keys)
PIX_GATEWAY_URL="https://api.mercadopago.com"
PIX_ACCESS_TOKEN="TEST-placeholder"
PIX_WEBHOOK_SECRET="webhook-secret-placeholder"

# Cloud Storage (placeholder)
S3_ENDPOINT="https://your-s3-endpoint.com"
S3_BUCKET="jukebox-songs"
S3_ACCESS_KEY="placeholder"
S3_SECRET_KEY="placeholder"
S3_REGION="sa-east-1"

# Admin
ADMIN_BILLING_PASSWORD="admin123"
ENVEOF
echo "Done."

# ============================================
# STEP 6: Database migration & seed
# ============================================
echo ""
echo "[6/8] Running database migrations and seed..."
cd /root/JukeBox
npx prisma generate --schema=apps/api/prisma/schema.prisma
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
npm run db:seed
echo "Done."

# ============================================
# STEP 7: Build & start services
# ============================================
echo ""
echo "[7/8] Building and starting services..."

# Build the web frontend
npm run build:web

# Start API with PM2
pm2 delete jukebox-api 2>/dev/null || true
pm2 start apps/api/src/server.ts --name jukebox-api --interpreter npx --interpreter-args "tsx"
pm2 save
pm2 startup 2>/dev/null || true
echo "Done."

# ============================================
# STEP 8: Configure Nginx
# ============================================
echo ""
echo "[8/8] Configuring Nginx..."
cat > /etc/nginx/sites-available/jukebox << 'NGINXEOF'
server {
    listen 80;
    server_name 45.55.220.142;

    # Frontend (built static files)
    root /root/JukeBox/apps/web/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1000;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket proxy (Socket.IO)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA fallback — all routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2|woff|ttf)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINXEOF

# Enable the site
ln -sf /etc/nginx/sites-available/jukebox /etc/nginx/sites-enabled/jukebox
rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
nginx -t
systemctl restart nginx
echo "Done."

# ============================================
# DONE!
# ============================================
echo ""
echo "=========================================="
echo "  DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "  App:        http://45.55.220.142"
echo "  TV Player:  http://45.55.220.142/tv-player"
echo "  API Health: http://45.55.220.142/api/v1/health"
echo ""
echo "  Credentials (all password: password123):"
echo "    Admin:      admin@jukebox.com      (Staff Login)"
echo "    Bar Owner:  carlos@bar1.com        (Staff Login)"
echo "    Employee:   lucas@jukebox.com      (Staff Login)"
echo "    Affiliate:  rafael@promo.com       (Staff Login)"
echo "    Customer:   joao@test.com + venue BAR-CARLOS"
echo "    Customer:   maria@test.com + venue BOTECO-ANA"
echo ""
echo "  PM2 Commands:"
echo "    pm2 status          — check if API is running"
echo "    pm2 logs jukebox-api — view API logs"
echo "    pm2 restart jukebox-api — restart API"
echo ""
echo "=========================================="
