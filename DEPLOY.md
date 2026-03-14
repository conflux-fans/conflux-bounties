# Deployment Guide

This guide covers deploying the Conflux Node Status Dashboard in production using Docker, systemd, and TLS reverse proxy.

## Quick Start with Docker

```bash
# Clone and setup
cp .env.example .env
cp config.example.json config.json

# Edit .env and config.json as needed

# Start the stack
docker compose up -d

# Access dashboard
# http://localhost:3000
```

## Demo Mode

To run with 24h of demo data:

```bash
# Set SEED_DEMO environment variable
echo "SEED_DEMO=true" >> .env

# Start the stack
docker compose up -d
```

This will seed 5 demo nodes with simulated metrics for testing the dashboard.

---

## Systemd Service (Recommended for Linux Servers)

Create a systemd service file:

```ini
# /etc/systemd/system/conflux-dashboard.service
[Unit]
Description=Conflux Node Status Dashboard
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/conflux-dashboard
ExecStart=/usr/bin/docker compose up
ExecStop=/usr/bin/docker compose down
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Setup:

```bash
# Install
sudo cp conflux-dashboard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable conflux-dashboard
sudo systemctl start conflux-dashboard

# Check status
sudo systemctl status conflux-dashboard

# View logs
sudo journalctl -u conflux-dashboard -f
```

---

## TLS Reverse Proxy with Nginx

### Option 1: Nginx as Reverse Proxy

Install nginx and configure:

```nginx
# /etc/nginx/sites-available/conflux-dashboard
server {
    listen 80;
    server_name dashboard.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dashboard.yourdomain.com;

    # SSL Certificate (let'sencrypt)
    ssl_certificate /etc/letsencrypt/live/dashboard.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dashboard.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/conflux-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Option 2: Certbot for SSL

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d dashboard.yourdomain.com

# Auto-renewal (certbot handles this automatically)
```

---

## Prometheus Integration

The dashboard exposes a Prometheus-compatible `/api/v1/metrics/prometheus` endpoint.

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'conflux-dashboard'
    static_configs:
      - targets: ['dashboard.yourdomain.com:3001']
    metrics_path: '/api/v1/metrics/prometheus'
```

Example Grafana dashboard JSON is available in `docs/grafana-dashboard.json`.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `DATABASE_PATH` | SQLite database path | `./data/dashboard.db` |
| `METRIC_INTERVAL_MS` | Polling interval (ms) | `5000` |
| `RETENTION_DAYS` | Data retention days | `30` |
| `CONFLUX_CORE_RPC_URLS` | Core space RPC URLs | `https://main.confluxrpc.com` |
| `CONFLUX_ESPACE_RPC_URLS` | eSpace RPC URLs | `https://evm.confluxrpc.com` |
| `ALERT_SLACK_WEBHOOK` | Slack webhook URL | - |
| `SMTP_*` | Email settings | - |
| `ALERT_WEBHOOK_URL` | Generic webhook URL | - |
| `API_KEYS` | Comma-separated API keys | - |
| `SEED_DEMO` | Seed demo data on startup | - |

---

## Backup and Restore

### Backup Database

```bash
# Stop the server
docker compose stop server

# Copy the database file
docker cp con flux-dashboard-server-1:/app/data/dashboard.db ./backup-dashboard.db

# Restart
docker compose start server
```

### Restore Database

```bash
# Stop the server
docker compose stop server

# Restore the database
docker cp ./backup-dashboard.db conflux-dashboard-server-1:/app/data/dashboard.db

# Restart
docker compose start server
```

---

## Updating

```bash
# Pull latest changes
git pull origin main

# Rebuild containers
docker compose build

# Restart services
docker compose up -d
```
