# Stamp — simple merchant rewards

Stamp-card loyalty for small shops (cookies, coffee, kuih, etc.).

Customers keep a card in a link — no app install. Merchants stamp at the counter with a live show code or camera scan.

**Stack:** Nuxt 4 · Vue 3 · Prisma · MySQL · Docker (local DB)

---

## Feature notes

### Roles

| Role | Login | Main URLs |
|------|--------|-----------|
| **Admin** | Platform operator | `/admin` — create shops, tick features, approve upgrades |
| **Merchant** | Shop owner | `/merchant` counter, `/merchant/customers`, `/merchant/settings` |
| **Customer** | No account | `/m/{slug}` — join, show code, card |

### Always included (core)

These work on every shop even with no paid features ticked:

- One active **STAMP** campaign (goal + reward label)
- Counter **stamp** and **redeem** by 4-digit show code or phone
- Customer list + **search**
- Welcome note + **brand color**
- Join link + basic QR preview (copy link; A5/A6 print needs **posters** feature)
- **90s cooldown** per customer on stamp (anti double-tap)
- Haptic + soft beep on successful stamp (browser)

### Optional features (admin ticks per shop)

Admin assigns features in **Admin → Edit features**. Price is the **sum of ticked items** (demo MYR/month in `shared/features.ts`). Merchant sees read-only plan in **Settings → Plan & features** and can **request upgrade** — only admin can change the package.

| Feature | What it unlocks |
|---------|-----------------|
| **multiCampaign** | Up to 5 active campaigns (else max 1) |
| **campaignTypes** | B1F1 and Bundle campaign types |
| **brandKit** | Logo upload, card themes, fonts, reward images |
| **socialLinks** | IG / FB / TikTok / WhatsApp on customer page |
| **staffPin** | Staff PINs + counter gate (max 20 staff) |
| **qrScan** | Camera scan of customer show-code QR |
| **undoStamp** | Undo last stamp within 15 minutes |
| **doubleDay** | Double progress toggle per campaign |
| **csvExport** | Download customers CSV |
| **whatsappBlast** | Inactive customer WhatsApp blast (needs WhatsApp env) |
| **joinOtp** | OTP on join (WhatsApp or demo OTP in dev) |
| **birthdayBonus** | Birthday MM-DD + free stamp on that day |
| **walletPass** | Wallet-lite pass page + PWA hints |
| **posters** | Print join poster A5 / A6 |

### Tier templates (guidance only)

Not a billing system — admin can **Apply Starter / Growth / Pro** to prefill ticks, then adjust:

| Template | Typical features | Demo total |
|----------|------------------|------------|
| **Starter** | brandKit, posters | RM 16 |
| **Growth** | Starter + multiCampaign, campaignTypes, staffPin, qrScan, undoStamp, socialLinks | RM 65 |
| **Pro** | All catalog features | RM 108 |

### Campaign types

- **STAMP** — collect N stamps → reward  
- **B1F1** — buy-one framing (goal often 1)  
- **BUNDLE** — bundle/set progress  

### WhatsApp (optional)

Set `WHATSAPP_*` in `.env` for real sends. Without it:

- Join OTP returns **`devOtp`** in API (UI shows code for demos)
- Almost-there / inactive blast no-ops or logs in dev

### Uploads

Merchant logos and reward images save under `public/uploads/{merchantId}/`. Folder is gitignored except `.gitkeep` — **back up uploads on production** or use external storage later.

---

## Install on local (step by step)

### Prerequisites

- **Node.js 20+** and npm  
- **Docker Desktop** (or Docker Engine) for MySQL  
- Git clone of this repo  

### Steps

1. **Clone and enter the project**

   ```bash
   cd simple-reward
   ```

2. **Start MySQL**

   ```bash
   docker compose up -d
   ```

   Wait until healthy (`docker compose ps`). Database: `simple_reward` on `127.0.0.1:3306` (user/password `reward` / `reward` — see `docker-compose.yml`).

3. **Environment file**

   ```bash
   cp .env.example .env
   ```

   For local dev the defaults are fine. Change `SESSION_SECRET` if you expose the app on your LAN.

4. **Install dependencies**

   ```bash
   npm install
   ```

5. **Apply database migrations**

   ```bash
   npm run db:deploy
   ```

6. **Seed demo data** (admin + 3 cafes + Cookie Cafe staff)

   ```bash
   npm run db:seed
   ```

7. **Run dev server**

   ```bash
   npm run dev
   ```

8. **Open in browser**

   - App: [http://localhost:3005](http://localhost:3005)  
   - Admin: [http://localhost:3005/admin](http://localhost:3005/admin)  
   - Login: [http://localhost:3005/login](http://localhost:3005/login)  

### Local demo accounts

| Role | Email | Password | Notes |
|------|-------|----------|--------|
| Admin | `admin@example.com` | `admin123` | Feature packages |
| Merchant | `merchant@cookie.cafe` | `merchant123` | Pro · staff Aina `1234`, Rafi `5678` |
| Merchant | `merchant@beanbrew.cafe` | `merchant123` | Growth |
| Merchant | `merchant@kopicorn.cafe` | `merchant123` | Starter |

Customer cards: `/m/cookie-cafe`, `/m/bean-and-brew`, `/m/kopi-corner`

### Useful npm scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server port **3005** |
| `npm run build` | Prisma generate + production Nuxt build |
| `npm run preview` | Serve `.output` locally |
| `npm run db:migrate` | Create new migration (schema change) |
| `npm run db:deploy` | Apply migrations (prod + local) |
| `npm run db:seed` | Re-seed demos (resets demo campaigns) |
| `npm run db:studio` | Prisma Studio GUI |

### Schema changes (code-first)

1. Edit `prisma/schema.prisma`  
2. `npm run db:migrate` — name the migration  
3. Commit `prisma/migrations/`  
4. On other machines: `npm run db:deploy`  

---

## Deploy on server (step by step)

Example: Ubuntu VPS with Nginx in front. Adjust for your host (Railway, Fly, etc.) — you always need **MySQL**, **Node 20+**, env vars, and a process manager.

### 1. Server prerequisites

```bash
# Node 20+ (via nvm or NodeSource — use your distro’s recommended method)
node -v   # should be v20+

# MySQL 8.x — managed DB (RDS, PlanetScale, etc.) OR install on same VPS
# Reverse proxy: nginx or Caddy
```

### 2. Database

- Create database e.g. `simple_reward` and a user with full rights on that DB.  
- Note connection string:

  ```text
  mysql://USER:PASSWORD@HOST:3306/simple_reward
  ```

- If MySQL is on the same machine as the app, `HOST` is often `127.0.0.1`.

### 3. Deploy application code

```bash
git clone <your-repo-url> /var/www/stamp
cd /var/www/stamp
npm ci
```

### 4. Production environment

Create `/var/www/stamp/.env` (never commit):

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/simple_reward"
SESSION_SECRET="<long-random-string-min-32-chars>"
ADMIN_EMAIL="admin@yourdomain.com"
ADMIN_PASSWORD="<strong-password>"

# Optional WhatsApp Cloud API
# WHATSAPP_TOKEN=""
# WHATSAPP_PHONE_NUMBER_ID=""
# WHATSAPP_TEMPLATE_ALMOST="stamp_almost_there"

# Optional — override seed admin only when running db:seed
# ADMIN_EMAIL / ADMIN_PASSWORD used by prisma/seed.ts
```

### 5. Migrate and build

```bash
npm run db:deploy
# First deploy only, if you want demo shops:
# npm run db:seed

npm run build
```

Output: `.output/server/index.mjs` (Nitro Node server).

### 6. Run with a process manager (systemd example)

Create `/etc/systemd/system/stamp.service`:

```ini
[Unit]
Description=Stamp Nuxt app
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/stamp
Environment=NODE_ENV=production
EnvironmentFile=/var/www/stamp/.env
ExecStart=/usr/bin/node /var/www/stamp/.output/server/index.mjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Nuxt listens on **port 3000** by default in production unless you set `NITRO_PORT` or `PORT`:

```bash
# In .env or Environment= in unit file
PORT=3000
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable stamp
sudo systemctl start stamp
sudo systemctl status stamp
```

### 7. Nginx reverse proxy (HTTPS)

Example site `/etc/nginx/sites-available/stamp`:

```nginx
server {
    listen 80;
    server_name stamp.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name stamp.example.com;

    # ssl_certificate /etc/letsencrypt/live/stamp.example.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/stamp.example.com/privkey.pem;

    client_max_body_size 2M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site, run Certbot for TLS, reload nginx.

### 8. Uploads and backups

- Persist **`public/uploads/`** across deploys (same disk or volume).  
- Back up **MySQL** regularly (mysqldump or provider snapshots).  
- After deploy: `npm run db:deploy` before restarting the service.

### 9. Deploy updates (routine)

```bash
cd /var/www/stamp
git pull
npm ci
npm run db:deploy
npm run build
sudo systemctl restart stamp
```

### Production checklist

- [ ] Strong `SESSION_SECRET` and admin password  
- [ ] HTTPS only (cookies are `secure` in production)  
- [ ] MySQL not exposed to the public internet  
- [ ] Uploads directory backed up  
- [ ] WhatsApp env if using OTP / blast in production  

---

## Quick demo walkthrough (5 min)

1. Start stack (see **Install on local**).  
2. Customer: [/m/cookie-cafe](http://localhost:3005/m/cookie-cafe) → Join → OTP (demo code on screen if no WhatsApp).  
3. Merchant: `merchant@cookie.cafe` / `merchant123` → PIN `1234` → stamp via show code or QR scan.  
4. Admin: `admin@example.com` / `admin123` → edit features / upgrade requests.  

---

## Tutorial: admin

1. [/login](http://localhost:3005/login) → admin account  
2. **Merchants** table — feature count and RM price  
3. **Edit features** — Apply Starter / Growth / Pro, tick items, Save  
4. **Upgrade requests** — approve tier or reject  
5. **Create merchant** — new shop starts on Starter template  

---

## Tutorial: merchant

### First-time signup

1. [/signup](http://localhost:3005/signup)  
2. Onboarding: shop → campaign → print QR  

### Counter

1. `/merchant` — stamp / redeem  
2. Staff PIN if enabled  
3. Scan QR, show code, or phone  
4. Undo (15 min), double day, redeem at goal  

### Settings

- Brand kit, campaigns, staff, social (per feature flags)  
- **Plan & features** — request upgrade to admin  

---

## Tutorial: customer

1. Open `/m/{slug}` or scan join QR  
2. Join with name + phone (+ OTP if shop has **joinOtp**)  
3. Show live code/QR at counter  
4. Optional birthday, wallet pass, PWA add-to-home  

---

## How it works

```text
Customer joins (/m/slug) → live show code
        ↓
Merchant scans/types code → stamp (or redeem)
        ↓
Customer reopens link anytime to see progress
```

---

## Project layout

```text
app/                 # Nuxt UI (pages, components, middleware)
server/api/          # Nitro API routes
server/utils/        # auth, prisma, features, whatsapp, …
shared/              # campaign, brand, features catalog
prisma/              # schema + migrations + seed
public/uploads/      # merchant uploads (not in git)
docker-compose.yml   # local MySQL only
```
