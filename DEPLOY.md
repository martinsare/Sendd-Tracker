# Deploying Senedd Tracker (SQLite) on Oracle Cloud "Always Free"

This project runs best on a **single long-running VM** because the backend uses a local **SQLite** file (`DB_PATH`). Most serverless platforms are not a good fit for persistent SQLite writes.

## Oracle Free Tier: what stays free

- The **Free Trial credit** (often shown as **$300**) expires after ~30 days.
- **Always Free** resources are intended to stay **$0 long-term** if you keep usage within the Always Free limits, but are still subject to Oracle policies/limits and regional capacity.
- Oracle can **reclaim idle Always Free compute** (so don't treat it like "set and forget" hosting).

## Staying within Always Free limits (recommended)

For this app, the safest "always free" setup is:

- **One VM**: `VM.Standard.A1.Flex` (Ampere/Arm) with **1 OCPU + 6 GB RAM** (or similar small sizing).
- **Boot volume**: keep it small (default ~50 GB).
- **Single process** backend (systemd) + **static frontend** + **Caddy** reverse proxy.
- If you want the simplest deploy on a tiny VM, the backend can also serve the built frontend directly (no Caddy/Nginx): set `FRONTEND_DIST_PATH=/opt/senedd-tracker/frontend/dist`.

If A1 isn't available, use:

- **`VM.Standard.E2.1.Micro`** (x86) with **1 GB RAM**. It works, but it's tight on memory.

### If you're on `VM.Standard.E2.1.Micro` (1 GB RAM): enable swap first

On the 1 GB "micro" VM, package installs/builds can get OOM-killed ("Killed"). Add a swapfile before running `dnf`/`apt` installs or `npm ci`.

Oracle Linux (swapfile):

```bash
sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
free -h
```

Ubuntu (swapfile):

```bash
sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
free -h
```

To reduce memory usage further on a micro VM, prefer:
- **Build locally** (on your laptop) and upload `backend/dist/` and `frontend/dist/` via `scp`
- Run only the **backend production install** on the VM (avoid building TypeScript/Vite on the VM)

### Quick rule of thumb (A1)

Always Free A1 is measured monthly as:

- OCPU-hours (example: `OCPUs * 24 * days_in_month`)
- GB-hours (example: `RAM_GB * 24 * days_in_month`)

So **1 OCPU + 6 GB** running 24/7 is typically well within the Always Free monthly pool.

## 1) Create an Always Free VM (Console)

Console path:
- `Compute -> Instances -> Create instance`

Key points:
- Create the instance in your **tenancy home region** (Always Free is tied to the home region).
- In the shape picker, pick a shape that is labeled **Always Free-eligible**.

### If you only see `E4.Flex` / `E5.Flex`

Those are **paid** shapes. To find the Always Free ones, in the shape picker:

- Click **Specialty and previous generation** and look for `VM.Standard.E2.1.Micro`, or
- Click **Ampere** and look for `VM.Standard.A1.Flex`

If there is a search box in the picker, search for:
- `E2.1.Micro`
- `A1.Flex`

Suggested instance settings:
- **Image**: Ubuntu LTS (recommended) or Oracle Linux
- **Shape**: `VM.Standard.A1.Flex` (set **1 OCPU / 6 GB**) or `VM.Standard.E2.1.Micro`
- **Public IPv4**: enabled
- **SSH keys**: add your public key

SSH username:
- Ubuntu images: `ubuntu`
- Oracle Linux images: `opc`

### Switching from `E2.1.Micro` to `A1.Flex` (recommended)

If you're currently on `VM.Standard.E2.1.Micro` and installs/builds are failing (OOM / "Killed"), create a new
Always Free `VM.Standard.A1.Flex` instance and move to it:

- `Compute -> Instances -> Create instance`
- **Change shape** -> **Ampere** -> `VM.Standard.A1.Flex`
  - Keep your total A1 allocation within Always Free (for example: **1 OCPU / 6 GB** for this app)
- **Networking**: select your existing VCN + **public subnet** (so you get a public IPv4)
- Add your SSH key and create the instance
- Deploy on the new instance, then **Terminate** the micro instance to stop fighting memory limits

Networking:
- Ensure inbound ports **80** and **443** are open (and **22** for SSH).
- If the wizard warns "You must select a public subnet to assign a public IPv4 address", the most reliable fix is to create the network first (so OCI definitely creates an Internet Gateway + public route table):
  - Use the Console's **search bar** (top of the page) and search for `Virtual Cloud Networks` (or `VCN`), then open it.
  - Go to `Networking -> Virtual Cloud Networks -> Start VCN Wizard -> VCN with Internet Connectivity` and finish the wizard.
  - Then return to `Compute -> Instances -> Create instance` and choose:
    - **Select existing virtual cloud network** (pick the VCN you just created)
    - **Select existing subnet** (pick the **public** subnet created by the wizard)
    - **Automatically assign public IPv4 address**

Security page (OCI wizard):
- If you see "You can enable either shielded instances or confidential computing but not both", keep the default (**Shielded instance**) and continue.
- On `VM.Standard.E2.1.Micro` you may not be able to enable **Confidential computing**. That's normal and not required for this deploy (confidential-capable shapes are often paid).

## 2) SSH in and install system packages

Ubuntu example:

```bash
sudo apt-get update
sudo apt-get install -y git ca-certificates curl build-essential
```

Oracle Linux example:

```bash
sudo dnf -y install git ca-certificates curl gcc gcc-c++ make
# Optional (can take a while on Always Free micro shapes):
# sudo dnf -y update
```

## 3) Install Node.js (LTS)

Using `nvm` (simple):

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install --lts
nvm use --lts
node -v
npm -v
```

## 4) Clone the repo and build

Pick a location (example: `/opt/senedd-tracker`):

```bash
sudo mkdir -p /opt/senedd-tracker
sudo chown -R "$USER":"$USER" /opt/senedd-tracker
cd /opt/senedd-tracker
git clone <YOUR_REPO_URL> .
```

Install and build:

```bash
npm ci
npm run build
```

## 5) Create a persistent data directory (SQLite)

```bash
sudo mkdir -p /var/lib/senedd-tracker
sudo chown -R "$USER":"$USER" /var/lib/senedd-tracker
```

SQLite file path example:
- `/var/lib/senedd-tracker/senedd-tracker.sqlite`

## 6) Configure backend environment variables

```bash
sudo mkdir -p /etc/senedd-tracker
sudo nano /etc/senedd-tracker/backend.env
```

Example:

```bash
PORT=5174
DB_PATH=/var/lib/senedd-tracker/senedd-tracker.sqlite
CACHE_TTL_SECONDS=86400
```

Lock down permissions:

```bash
sudo chmod 600 /etc/senedd-tracker/backend.env
```

## 7) Run the backend as a systemd service

```bash
sudo nano /etc/systemd/system/senedd-tracker-backend.service
```

Example:

```ini
[Unit]
Description=Senedd Tracker Backend API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/senedd-tracker/backend
EnvironmentFile=/etc/senedd-tracker/backend.env
ExecStart=/usr/bin/env node /opt/senedd-tracker/backend/dist/index.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now senedd-tracker-backend
sudo systemctl status senedd-tracker-backend --no-pager
```

Health check:

```bash
curl -s http://127.0.0.1:5174/api/health
```

## 8) Serve the frontend and proxy `/api`

You have two common choices.

### Option 0 (simplest): backend serves the frontend

If you want to avoid installing a reverse proxy, you can serve the built frontend from the backend process:

- Ensure you have built the frontend (`npm run build -w frontend`) so `frontend/dist/` exists.
- Set `FRONTEND_DIST_PATH=/opt/senedd-tracker/frontend/dist` in `/etc/senedd-tracker/backend.env`.
- Make sure your instance Security List/NSG allows inbound `PORT` (example: 5174) or run on port 80.

### Option A (recommended): Caddy (easy HTTPS)

Install Caddy (Ubuntu):

```bash
sudo apt-get install -y caddy
```

Create a Caddyfile:

```bash
sudo nano /etc/caddy/Caddyfile
```

Example (replace `YOUR_DOMAIN`):

```caddy
YOUR_DOMAIN {
  root * /opt/senedd-tracker/frontend/dist
  file_server

  handle_path /api/* {
    reverse_proxy 127.0.0.1:5174
  }
}
```

Reload:

```bash
sudo caddy reload --config /etc/caddy/Caddyfile
```

### Option B: Nginx (manual TLS via Certbot)

Install Nginx:

```bash
sudo apt-get install -y nginx
```

Create a site config:

```bash
sudo nano /etc/nginx/sites-available/senedd-tracker
```

Example (HTTP only):

```nginx
server {
  listen 80;
  server_name YOUR_DOMAIN;

  root /opt/senedd-tracker/frontend/dist;
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:5174/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

Enable and reload:

```bash
sudo ln -sf /etc/nginx/sites-available/senedd-tracker /etc/nginx/sites-enabled/senedd-tracker
sudo nginx -t
sudo systemctl reload nginx
```

## 9) Updates

From `/opt/senedd-tracker`:

```bash
git pull
npm ci
npm run build
sudo systemctl restart senedd-tracker-backend
```

## 10) Backups (SQLite)

Back up the SQLite file regularly.

Quick manual backup:

```bash
cp /var/lib/senedd-tracker/senedd-tracker.sqlite /var/lib/senedd-tracker/senedd-tracker.sqlite.bak
```

## Notes / constraints

- SQLite is safest with **one backend instance**. If you need horizontal scaling, plan to migrate to Postgres.
- Always Free availability can be subject to capacity in your region/AD.
