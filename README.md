# ICA CRM — Enterprise Lead Management System
> Innovation, Consulting & Automation | Support: +91 9967969850

---

## 📋 PROJECT BLUEPRINT
*This document is the single source of truth. Resume any session by sharing this file.*

---

## 🗂️ Quick Reference

| Item | Detail |
|------|--------|
| **GitHub** | https://github.com/icassameer/icacrmweb.in |
| **Branch** | `master` |
| **Domain** | crm.icaweb.in (DNS pending VPS IP) |
| **Support** | +91 9967969850 |
| **Local Dev** | http://localhost:5000 |
| **Node Version** | v20.x (v24 also works locally) |
| **DB** | PostgreSQL via Drizzle ORM |
| **SOP Doc** | ICA_CRM_SOP_v2.docx (security + migration guide) |

---

## ✅ COMPLETED TASKS

| Task | Status | Commit |
|------|--------|--------|
| Initial CRM build (all roles) | ✅ Done | Initial commit |
| AI Proceeding with monthly limits | ✅ Done | Initial commit |
| Team Leader view-only AI Proceeding | ✅ Done | Initial commit |
| Bulk lead upload + auth template download | ✅ Done | Initial commit |
| RC lookup feature (attempted) | ❌ Reverted | Revert RC lookup |
| RC lookup reverted (routes + frontend) | ✅ Done | Revert RC lookup |
| Security hardening v2 | ✅ Done | Security hardening |
| helmet.js security headers | ✅ Done | Security hardening |
| CORS restriction to production domain | ✅ Done | Security hardening |
| Zod input validation (login + signup) | ✅ Done | Security hardening |
| File type validation on uploads | ✅ Done | Security hardening |
| Seed endpoint blocked in production | ✅ Done | Security hardening |
| PM2 cluster config (ecosystem.config.cjs) | ✅ Done | Security hardening |
| Nginx production config (nginx.conf) | ✅ Done | Security hardening |
| VPS setup script (setup-vps.sh) | ✅ Done | Security hardening |
| Deploy script (deploy.sh) | ✅ Done | Security hardening |
| Pushed to GitHub (master branch) | ✅ Done | — |

---

## ⏳ PENDING TASKS (In Order)

| # | Task | Notes |
|---|------|-------|
| 1 | 💳 Get international payment method | Niyo Global (free) or Scapia card — need Aadhaar + PAN |
| 2 | 🖥️ Buy Hetzner CX22 VPS | €4/month (~₹360) — hetzner.com/cloud |
| 3 | 🤖 Get OpenAI API key | platform.openai.com — add $10 credits |
| 4 | 🌐 Point DNS to VPS | crm.icaweb.in → VPS IP (GoDaddy panel) |
| 5 | 🚀 Run setup-vps.sh on server | Fresh Ubuntu 24.04 setup |
| 6 | ⚙️ Configure .env on server | SESSION_SECRET + DATABASE_URL + OPENAI_API_KEY |
| 7 | 🗄️ Restore database backup | Upload + restore ica_crm_backup.sql |
| 8 | 🔐 Get SSL certificate | sudo certbot --nginx -d crm.icaweb.in |
| 9 | ✅ Go live testing | All roles + AI Proceeding + Excel export |
| 10 | 🔑 RC lookup (future) | Use Surepass API (₹2-3/lookup) — proper paid API |

---

## 🏗️ ARCHITECTURE

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TailwindCSS + Shadcn UI + Recharts |
| Backend | Express.js 5 + TypeScript + JWT |
| Database | PostgreSQL + Drizzle ORM |
| AI | OpenAI Whisper (transcription) + GPT-4o-mini (analysis) |
| Auth | JWT (24h expiry) + bcrypt (10 rounds) |
| Security | helmet + cors + express-rate-limit + zod |
| Process | PM2 cluster mode (all CPU cores) |
| Web Server | Nginx (reverse proxy + SSL) |

### Role Hierarchy
```
MASTER_ADMIN
  └── AGENCY_ADMIN
        └── TEAM_LEADER
              └── TELE_CALLER
```

| Role | Permissions |
|------|------------|
| MASTER_ADMIN | Create agencies, assign plans, approve users, view all AI proceedings, delete agencies (cascade) |
| AGENCY_ADMIN | Manage users, leads, services, AI Proceeding (PRO+), reports, request plan upgrades |
| TEAM_LEADER | Add/assign/delete leads, view team performance, view AI proceedings (read-only) |
| TELE_CALLER | Update assigned leads only, view personal KPIs |

### Subscription Plans
| Plan | AI Proceeding | Lead Limit | User Limit |
|------|--------------|------------|------------|
| BASIC | ❌ No access | 500 | 10 |
| PRO | ✅ 10/month | 2,000 | 50 |
| ENTERPRISE | ✅ Unlimited | 10,000 | 200 |

---

## 🔐 SECURITY IMPLEMENTATION (v2)

### Applied Controls
- ✅ `helmet.js` — X-Frame-Options, HSTS, CSP, noSniff, referrer policy
- ✅ CORS restricted to `crm.icaweb.in` in production
- ✅ Rate limiting: Login (10/15min), Signup (5/hr), API (200/min), Uploads (10/min)
- ✅ Zod validation on all auth endpoints
- ✅ File MIME type validation on uploads
- ✅ `/api/seed` blocked in production (returns 404)
- ✅ JWT secret length enforced (32+ chars minimum)
- ✅ Tokens/passwords scrubbed from server logs
- ✅ Generic error messages in production (no stack traces)
- ✅ Body size capped at 1MB (prevents body bombing)
- ✅ Audit logs for all sensitive operations

### Remaining Security TODOs (P2/P3)
- ⏳ Brute force account lockout (after 5 failed logins, lock 15min)
- ⏳ Database field-level encryption for phone/email
- ⏳ Dependency vulnerability scanning (npm audit in CI)
- ⏳ Privacy policy + data retention policy docs

### SOC 2 Score
- Current: **62/100**
- Target: **90/100** (after P1 fixes above)

---

## 💰 COST BREAKDOWN

| Item | Cost |
|------|------|
| Hetzner CX22 VPS | €4/month (~₹360) — increases to €4.49 from April 2026 |
| OpenAI API (10 agencies PRO) | ~$18/month (~₹1,500) |
| Domain (icaweb.in) | Already owned (GoDaddy) |
| **Total** | **~₹1,900/month** |

### OpenAI Cost Detail
- Whisper transcription: $0.006/min (~₹0.50/min)
- GPT-4o-mini analysis: ~$0.002/meeting
- 10 meetings × 30min = ~$1.82/month per agency
- Start with: **$10 credits**

---

## 🚀 DEPLOYMENT GUIDE

### Quick Deploy (after VPS is ready)
```bash
# On server — first time only:
chmod +x setup-vps.sh && ./setup-vps.sh

# Configure environment:
cp .env.example .env
nano .env  # Fill in SESSION_SECRET, DATABASE_URL, OPENAI_API_KEY

# Build and start:
npm install && npm run build
pm2 start ecosystem.config.cjs --env production
pm2 save && pm2 startup

# Setup Nginx:
cp nginx.conf /etc/nginx/sites-available/ica-crm
ln -s /etc/nginx/sites-available/ica-crm /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# SSL:
certbot --nginx -d crm.icaweb.in
```

### Future Updates (after each git push)
```bash
ssh root@YOUR_VPS_IP
cd /var/www/ica-crm
./deploy.sh   # Pulls, builds, restarts automatically
```

---

## 🗄️ DATABASE

### Schema Tables
| Table | Purpose |
|-------|---------|
| agencies | Multi-tenant agency records |
| users | All users across all agencies |
| leads | Lead records (unique per agency+phone) |
| audit_logs | All sensitive action logs |
| meetings | AI Proceeding recordings + analysis |
| services | Agency-specific service types |
| upgrade_requests | Plan upgrade workflow |
| conversations | Replit AI chat (integration) |
| messages | Replit AI messages (integration) |

### Key Indexes
```sql
-- Already in schema:
leads: (agency_code, phone) UNIQUE
leads: agency_code, status, assigned_to, follow_up_date, service
audit_logs: agency_code, lead_id, user_id, created_at
meetings: agency_code, created_by
users: agency_code, role, status
agencies: agency_code
```

### Restore Backup on VPS
```bash
# Upload from local machine:
scp ica_crm_backup.sql root@VPS_IP:/var/www/ica-crm/

# Restore on server:
psql postgresql://ica_user:PASSWORD@localhost:5432/ica_crm < ica_crm_backup.sql
```

---

## 🔑 ENVIRONMENT VARIABLES

```env
# Generate SESSION_SECRET with:
# openssl rand -base64 64

SESSION_SECRET=256bit_random_string_min_32_chars
DATABASE_URL=postgresql://ica_user:StrongPassword@localhost:5432/ica_crm
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxx
NODE_ENV=production
ALLOWED_ORIGINS=https://crm.icaweb.in
```

> ⚠️ NEVER commit `.env` to GitHub. It's in `.gitignore`.

---

## 🧪 DEMO CREDENTIALS

| Role | Username | Password | Agency |
|------|----------|----------|--------|
| Master Admin | masteradmin | admin123 | — |
| Agency Admin | agencyadmin | agency123 | ICA-DEMO01 (PRO) |
| Team Leader | teamlead1 | team123 | ICA-DEMO01 |
| Tele Caller | telecaller1 | caller123 | ICA-DEMO01 |

> ⚠️ Change all passwords before going live!

---

## 📁 PROJECT STRUCTURE

```
icacrmweb.in/
├── client/
│   ├── src/
│   │   ├── pages/          # All page components
│   │   ├── components/     # Shared UI components
│   │   ├── hooks/          # use-api, use-toast, use-mobile
│   │   └── lib/            # auth.tsx, queryClient.ts
│   └── public/             # Static assets + logo
├── server/
│   ├── index.ts            # Express setup + security middleware
│   ├── routes.ts           # All API endpoints
│   ├── storage.ts          # Database CRUD layer
│   ├── db.ts               # PostgreSQL connection
│   └── replit_integrations/ # OpenAI audio/image/chat clients
├── shared/
│   └── schema.ts           # Drizzle schema + Zod validators
├── .env.example            # Environment variable template
├── .gitignore              # Excludes .env, node_modules, dist
├── ecosystem.config.cjs    # PM2 cluster production config
├── nginx.conf              # Nginx reverse proxy + SSL config
├── deploy.sh               # One-command deployment script
├── setup-vps.sh            # Fresh VPS setup script
└── ICA_CRM_SOP_v2.docx    # Full SOP + security + migration guide
```

---

## 🔧 TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| `DATABASE_URL must be set` | Copy `.env.example` → `.env` and fill values |
| Logo not loading | Copy `attached_assets/ica-logo*.jpg` → `client/public/` |
| App not starting on VPS | `pm2 logs ica-crm` to see errors |
| SSL certificate error | `sudo certbot renew` (expires every 90 days) |
| Git push rejected | Use Personal Access Token, not GitHub password |
| Rate limit 429 error | Expected — client retries after 15 minutes |
| OpenAI not working | Check `OPENAI_API_KEY` in `.env` and billing credits |

---

## 🔮 FUTURE FEATURES (Backlog)

| Feature | Notes |
|---------|-------|
| RC Vehicle Lookup | Use Surepass API (₹2-3/lookup) — reverted from RapidAPI |
| WhatsApp Integration | Send lead updates via WhatsApp Business API |
| Email Notifications | Follow-up reminders via SMTP |
| Mobile App | React Native wrapper |
| Advanced Analytics | Custom date range reports |
| Data Export (PDF) | PDF report generation |

---

## 📞 CONTACTS & ACCOUNTS

| Service | Account | Notes |
|---------|---------|-------|
| GitHub | icassameer | icacrmweb.in repo |
| Domain | GoDaddy | icaweb.in |
| VPS | Hetzner (pending) | Need Niyo/Scapia card |
| OpenAI | (pending) | Need $10 credits |
| Support | +91 9967969850 | ICA team |

---

*Last updated: March 2026 | Version: 2.0 | Status: Security hardened, pending VPS deployment*
