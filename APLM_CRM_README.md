# APLM CRM — White-Label CRM Platform
> APLM Sales & Marketing | Powered by ICA — Innovation, Consulting & Automation

---

## 📋 PROJECT BLUEPRINT
*Share this file at the start of any new session to resume work instantly.*

---

## 🔗 Quick Reference

| Item | Detail |
|------|--------|
| **CRM URL** | https://crm.aplmsales.com ✅ LIVE |
| **Marketing Site** | https://aplmsales.com *(pending — website not built yet)* |
| **GitHub** | https://github.com/icassameer/aplm (private) |
| **Branch** | `master` |
| **Domain** | aplmsales.com (GoDaddy) |
| **Server IP** | 203.174.22.119 (shared VPS with ICA CRM) |
| **Server Name** | crmicawebin (HostBet) |
| **SSH** | `ssh root@203.174.22.119` (port 22) |
| **Working Dir** | /var/www/aplm-crm |
| **Website Dir** | /var/www/aplm-web *(empty — pending website build)* |
| **OS** | Ubuntu 24.04 LTS |
| **VPS Plan** | Micro — 2 vCPU, 4GB RAM, 40GB NVMe |

---

## 🗄️ Database

| Item | Detail |
|------|--------|
| **Engine** | PostgreSQL 16 |
| **Database** | aplm_crm *(separate from ica_crm)* |
| **User** | postgres |
| **URL** | postgresql://postgres:Admin@1234@localhost:5432/aplm_crm |
| **ORM** | Drizzle ORM |

---

## ⚙️ Server .env

```
PORT=5001
DATABASE_URL=postgresql://postgres:Admin@1234@localhost:5432/aplm_crm
NODE_ENV=production
SESSION_SECRET=AplmCrm@SecretKey2024@APLM@Sales@Marketing@SECURE@321@aplmsales
ALLOWED_ORIGINS=https://crm.aplmsales.com,https://aplmsales.com,https://www.aplmsales.com
FROM_EMAIL=support@aplmsales.com
FROM_NAME=APLM Team
ANTHROPIC_API_KEY=<same as ICA>
RESEND_API_KEY=<same as ICA>
OPENAI_API_KEY=<same as ICA>
RAZORPAY_KEY_ID=<managed by Sameer/ICA>
RAZORPAY_KEY_SECRET=<managed by Sameer/ICA>
ADDON_WEBHOOK_SECRET=<same as ICA>
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TailwindCSS + Shadcn UI |
| Backend | Express.js 5 + TypeScript |
| Database | PostgreSQL 16 + Drizzle ORM (aplm_crm) |
| AI Suite | Anthropic Claude — Haiku + Sonnet |
| Email | Resend API — FROM: support@aplmsales.com |
| Payments | Razorpay (managed by Sameer/ICA) |
| Process Manager | PM2 fork mode — port 5001 (id: 8) |
| Web Server | Nginx + SSL (Let's Encrypt) |
| Hosting | HostBet VPS 203.174.22.119 — shared with ICA CRM |

---

## 👥 Roles & Access (No MASTER_ADMIN)

| Role | Access |
|------|--------|
| AGENCY_ADMIN | Top-level — full agency control, leads, users, AI tools, reports, RC lookup |
| TEAM_LEADER | Add leads, bulk upload, assign to telecallers, view team performance |
| TELE_CALLER | Own assigned leads — update status, remarks, WhatsApp, inline AI |

> ⚠️ No MASTER_ADMIN in APLM CRM. Sameer manages subscription via ICA backend.

---

## 🎨 Branding

| Asset | Status |
|-------|--------|
| Logo | ✅ aplm.jpeg — circular, in attached_assets/ |
| Primary Color | ✅ Purple #7c3aed / Indigo gradient |
| Login Theme | ✅ Dark purple/indigo gradient — professional |
| Company Name | ✅ APLM Sales & Marketing |
| Sidebar | ✅ APLM logo + "APLM CRM" + "Powered by ICA" |
| Support Email | support@aplmsales.com *(Resend domain pending verification)* |

---

## 🚀 PM2 & Server Commands

```bash
# Status
pm2 status

# Logs
pm2 logs aplm-crm --lines 50

# Deploy updates
cd /var/www/aplm-crm && git pull origin master && npm run build && pm2 restart aplm-crm

# If .env changed
pm2 restart aplm-crm --update-env

# All apps on server
# id 4 — inventopro-api
# id 5 — ica-crm       (port 5000)
# id 8 — aplm-crm      (port 5001)
```

---

## 🌐 Nginx Config

**File:** `/etc/nginx/sites-available/aplm-crm`

```nginx
server {
    listen 80;
    server_name aplmsales.com www.aplmsales.com crm.aplmsales.com;
    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🚀 APLM Agency Onboarding Flow

```
Step 1 — Sameer creates agency via DB/API on APLM instance
Step 2 — Create AGENCY_ADMIN account (username + password)
Step 3 — Activate subscription — select plan + days
Step 4 — Share credentials via WhatsApp
         URL: https://crm.aplmsales.com
         Username + Password
Step 5 — APLM Admin creates TEAM_LEADER + TELE_CALLER
Step 6 — TEAM_LEADER adds leads → assigns to telecallers
Step 7 — TELE_CALLERs call leads → use AI tools
```

---

## ✅ COMPLETED

| Task | Date |
|------|------|
| Project scoped and planned | Mar 28, 2026 |
| aplmsales.com domain purchased (GoDaddy) | Mar 28, 2026 |
| DNS A records configured (@ + www + crm → 203.174.22.119) | Mar 28, 2026 |
| /var/www/aplm-crm forked from ICA CRM v9.3 | Mar 28, 2026 |
| /var/www/aplm-web folder created | Mar 28, 2026 |
| aplm_crm PostgreSQL database created + migrations run | Mar 28, 2026 |
| .env configured (port 5001, aplm_crm, APLM Team) | Mar 28, 2026 |
| PM2 instance aplm-crm started (id 8, fork mode, port 5001) | Mar 28, 2026 |
| Nginx config created and enabled | Mar 28, 2026 |
| SSL certificate installed (certbot) | Mar 28, 2026 |
| crm.aplmsales.com — HTTP 200 LIVE ✅ | Mar 28, 2026 |
| PM2 saved (auto-restart on reboot) | Mar 28, 2026 |
| APLM logo applied (login + sidebar) | Mar 28, 2026 |
| Login page redesigned — dark purple/indigo theme | Mar 28, 2026 |
| Sidebar branding updated — APLM CRM + Powered by ICA | Mar 28, 2026 |
| GitHub repo created: icassameer/aplm | Mar 28, 2026 |
| Initial commit pushed + tagged v0.1 | Mar 28, 2026 |
| README + SOP updated | Mar 28, 2026 |

---

## ⏳ PENDING TASKS

| Task | Priority |
|------|----------|
| Build aplmsales.com marketing website | 🔴 High |
| Verify aplmsales.com domain in Resend dashboard | 🟡 Medium |
| Setup support@aplmsales.com email (ImprovMX) | 🟡 Medium |
| Hide MASTER_ADMIN UI (WHITELABEL_MODE) | 🟡 Medium |
| Onboard APLM Agency Admin | 🟡 Medium |
| Create APLM agency + admin account in CRM | 🟡 Medium |

---

## 📁 Key File Locations

| File | Path |
|------|------|
| Backend entry | server/index.ts |
| Backend routes | server/routes.ts |
| Email functions | server/email.ts |
| DB schema | shared/schema.ts |
| Login page | client/src/pages/login.tsx |
| Sidebar | client/src/components/app-sidebar.tsx |
| Nginx config | /etc/nginx/sites-available/aplm-crm |
| APLM website | /var/www/aplm-web/ |
| APLM logo | /var/www/aplm-crm/attached_assets/aplm.jpeg |
| .env | /var/www/aplm-crm/.env |

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|---------|
| Site not loading | `pm2 restart aplm-crm --update-env` |
| 502 Bad Gateway | `curl http://localhost:5001/api/auth/me` — rebuild if fails |
| Build failed | `npm run build 2>&1 \| grep ERROR` |
| Emails not sending | Check RESEND_API_KEY + verify aplmsales.com in Resend |
| DB error | `psql -U postgres -h localhost -d aplm_crm` |
| SSL expired | `certbot renew && systemctl reload nginx` |
| Browser showing old UI | Hard refresh — Ctrl+Shift+R |
| Does this affect ICA CRM? | No — isolated on port 5000 with ica_crm DB |

---

## 🏷️ Version History

| Version | Date | Changes |
|---------|------|---------|
| v0.1 | Mar 28, 2026 | Project scoped. Domain purchased. Full infra setup. crm.aplmsales.com LIVE. APLM branding applied (logo, login, sidebar). GitHub repo created. README + SOP updated. |

---

*Last updated: March 28, 2026 | v0.1 | Sameer | ICA — Innovation, Consulting & Automation*
