# ICA CRM — Enterprise Lead Management System
> Innovation, Consulting & Automation | Support: +91 99679 69850 | support@icaweb.in

---

## 📋 PROJECT BLUEPRINT
*This is the single source of truth. Share this file at the start of any new session to resume work instantly.*

---

## 🔗 Quick Reference

| Item | Detail |
|------|--------|
| **Live URL** | https://crm.icaweb.in |
| **Marketing Site** | https://icaweb.in |
| **GitHub** | https://github.com/icassameer/icacrmweb.in |
| **Branch** | `master` |
| **Server IP** | 203.174.22.119 |
| **Server Name** | crmicawebin (HostBet) |
| **SSH** | `ssh root@203.174.22.119` (port 22) |
| **Root Password** | Icacrm@321 |
| **Working Dir** | /var/www/ica-crm |
| **Website Dir** | /var/www/icaweb-in |
| **OS** | Ubuntu 24.04 LTS |
| **Plan** | Micro — 2 vCPU, 4GB RAM, 40GB NVMe |
| **Support Portal** | https://clients.hostbet.in/ |
| **VS Code SSH** | Remote-SSH extension → Host: ICA-CRM → 203.174.22.119 |

---

## 🗄️ Database

| Item | Detail |
|------|--------|
| **Engine** | PostgreSQL 16 |
| **Database** | ica_crm |
| **User** | postgres |
| **Password** | Admin@1234 |
| **URL** | postgresql://postgres:Admin@1234@localhost:5432/ica_crm |
| **ORM** | Drizzle ORM |

---

## ⚙️ Server .env

```
SESSION_SECRET=IcaCrm@SecretKey2024@Sameer@321@ICA@CRM@SECURE
DATABASE_URL=postgresql://postgres:Admin@1234@localhost:5432/ica_crm
OPENAI_API_KEY=<real key added>
NODE_ENV=production
ALLOWED_ORIGINS=https://crm.icaweb.in
RESEND_API_KEY=<active — domain icaweb.in verified>
FROM_EMAIL=support@icaweb.in
RC_API_KEY=<pending — Surepass>
RAZORPAY_KEY_ID=<live key>
RAZORPAY_KEY_SECRET=<live secret>
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TailwindCSS + Shadcn UI |
| Backend | Express.js 5 + TypeScript |
| Database | PostgreSQL 16 + Drizzle ORM |
| AI | OpenAI Whisper (transcription) + GPT-4o (analysis) |
| Email | Resend API — domain icaweb.in (Verified) |
| Payments | Razorpay (live) — UPI, Cards, NetBanking, Wallets, EMI |
| Process Manager | PM2 cluster (2 instances) |
| Web Server | Nginx + SSL (Let's Encrypt) |
| Security | helmet.js + CORS + rate-limit + Zod validation |

---

## 👥 Roles & Access

| Role | Access |
|------|--------|
| MASTER_ADMIN | Full system — all agencies, users, plans, upgrade approvals, subscription management |
| AGENCY_ADMIN | Own agency — leads, users, AI Proceeding, RC lookup, reports, plan upgrades, payments |
| TEAM_LEADER | Add leads, bulk upload, assign leads to telecallers, view team performance |
| TELE_CALLER | Own assigned leads only — add/edit/call/WhatsApp/update status |

> TEAM_LEADER is the **only** role that can assign leads to telecallers.

---

## 💰 Pricing Plans (FINAL — LOCKED)

| Feature | BASIC ₹2,500/mo | PRO ₹5,500/mo | ENTERPRISE ₹12,000/mo |
|---------|:-:|:-:|:-:|
| Leads | Custom (set by admin) | Custom (set by admin) | Custom (set by admin) |
| Users | Custom (set by admin) | Custom (set by admin) | Custom (set by admin) |
| AI Proceeding | ❌ | 15/month | 40/month |
| RC Lookup | ❌ | 50/month | 200/month |
| WhatsApp | ✅ | ✅ | ✅ |
| Automated Emails | ✅ | ✅ | ✅ |
| Subscription | 30 days/payment | 30 days/payment | 30 days/payment |

> Add-on packs (Coming Soon): 10 RC ₹99 | 25 RC ₹199 | 5 AI ₹199 | 15 AI ₹499

---

## ✅ COMPLETED FEATURES

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-role auth (JWT) | ✅ | 4 roles |
| Lead management | ✅ | CRUD + bulk upload |
| WhatsApp click-to-chat | ✅ | |
| AI Proceeding | ✅ | GPT-4o + Whisper background processing |
| Multilingual transcription | ✅ | Hindi/Marathi/English |
| RC Lookup UI | ✅ | API key pending |
| Plan limits enforcement | ✅ | Leads, users, AI, RC per plan |
| Performance reports | ✅ | |
| Audit logs | ✅ | |
| DB-backed job processing | ✅ | PM2 cluster safe |
| VPS deployment | ✅ | HostBet Micro |
| Nginx + SSL | ✅ | crm.icaweb.in + icaweb.in |
| Resend email integration | ✅ | All transactional emails |
| Marketing website | ✅ | icaweb.in |
| Privacy policy page | ✅ | icaweb.in/privacy-policy |
| Razorpay live payments | ✅ | Website + CRM |
| Edit agency limits | ✅ | MASTER_ADMIN per agency |
| Subscription expiry system | ✅ | 30-day cycle, auto-expire |
| Subscription renewal banner | ✅ | Shows in CRM at ≤7 days/expired/trial |
| Razorpay webhook auto-activate | ✅ | Payment → expiry +30 days |
| Manual extend (MASTER_ADMIN) | ✅ | POST /api/subscription/extend |
| Subscription emails | ✅ | Confirmation, reminder, expired |
| Daily subscription cron | ✅ | setInterval in server/index.ts — fires on startup + every 24h |

---

## 🔄 Subscription Lifecycle

```
Customer pays on icaweb.in or CRM
        ↓
Razorpay fires → /api/subscription/webhook
        ↓
Verify signature → find agency → set expiry = today + 30 days
        ↓
Day 23 → 7-day reminder email  (cron: daysLeft === 7)
Day 29 → 1-day urgent reminder  (cron: daysLeft === 1)
Day 30 → expired → banner in CRM → Renew button
        ↓
cron: daysLeft ≤ 0 → SET subscription_status='EXPIRED', is_active=false → send expired email
        ↓
Customer pays → webhook fires → expiry + 30 more days
```

### Subscription API Endpoints
```
GET  /api/subscription/status    → plan, expiry, days left
POST /api/subscription/extend    → MASTER_ADMIN manual extend
POST /api/subscription/webhook   → Razorpay auto-activate
```

### Razorpay Webhooks Registered
| URL | Purpose |
|-----|---------|
| /api/payments/webhook | Legacy payment verify |
| /api/subscription/webhook | Subscription auto-activate |

---

## ⏱️ Daily Cron — Implementation Details

The cron lives in `server/index.ts` inside the `(async () => { ... })()` bootstrap block.

**Key design decisions:**
- `import "dotenv/config"` MUST be the first import in `server/index.ts` — before email imports — so `RESEND_API_KEY` is loaded before Resend initializes
- Uses raw `db.execute(sql`...`)` with a JOIN query to get agency + AGENCY_ADMIN email in one shot
- Deduplicates by `agency_code` (in case an agency has multiple AGENCY_ADMINs)
- PM2 cluster safe — idempotent: checks `subscription_status !== 'EXPIRED'` before updating
- Fires 10 seconds after startup, then every 24 hours

**Email functions** (in `server/email.ts`):
- `sendSubscriptionReminderEmail(agencyName, to, fullName, plan, daysLeft, expiresAt)`
- `sendSubscriptionExpiredEmail(agencyName, to, fullName, plan)`

**To set subscription expiry for a new agency:**
```sql
UPDATE agencies
SET subscription_status = 'ACTIVE',
    subscription_expiry = NOW() + INTERVAL '30 days'
WHERE agency_code = 'ICA-XXXXXX';
```

**To verify cron is running:**
```bash
pm2 logs ica-crm --lines 10
# Look for: [cron] Subscription cron done — X agencies checked
```

---

## 📧 Email Triggers (Resend)

| Email | Trigger | Function |
|-------|---------|----------|
| Welcome | New agency admin created | `sendWelcomeEmail` |
| Prospect Inquiry | Manual by MASTER_ADMIN | `sendProspectEmail` |
| Plan Upgrade | MASTER_ADMIN approves upgrade | `sendPlanUpgradeEmail` |
| Payment Confirmation | Webhook payment.captured | `sendPaymentSuccessEmail` |
| 7-day Reminder | Daily cron — daysLeft === 7 | `sendSubscriptionReminderEmail` |
| 1-day Reminder | Daily cron — daysLeft === 1 | `sendSubscriptionReminderEmail` |
| Plan Expired | Daily cron — daysLeft ≤ 0 | `sendSubscriptionExpiredEmail` |

---

## 🚀 Common Server Commands

```bash
ssh root@203.174.22.119
cd /var/www/ica-crm

pm2 status
pm2 logs ica-crm --lines 50

# Deploy
git pull origin master && npm run build && pm2 restart all --update-env

# Edit env
nano /var/www/ica-crm/.env && pm2 restart all --update-env

# DB
psql -U postgres -h localhost -d ica_crm

# Check subscriptions
psql -U postgres -h localhost -d ica_crm -c \
  "SELECT name, plan, subscription_status, subscription_expiry FROM agencies;"

# Exit psql
\q

# SSL
certbot renew
```

> ⚠️ Always use `pm2 restart all --update-env` when .env has changed

---

## 📁 Key File Locations

| File | Path |
|------|------|
| Backend entry + cron | server/index.ts |
| Backend routes | server/routes.ts |
| Email functions | server/email.ts |
| DB schema | shared/schema.ts |
| Storage layer | server/storage.ts |
| Main app layout | client/src/App.tsx |
| Subscription banner | client/src/components/SubscriptionBanner.tsx |
| Sidebar nav | client/src/components/app-sidebar.tsx |
| Nginx (CRM) | /etc/nginx/sites-enabled/ica-crm |
| Nginx (website) | /etc/nginx/sites-enabled/icaweb-in |
| Marketing website | /var/www/icaweb-in/index.html |
| Privacy policy | /var/www/icaweb-in/privacy-policy.html |
| Razorpay key (website) | search `rzp_live_` in /var/www/icaweb-in/index.html |
| Razorpay key (CRM) | search `rzp_live_` in client/src/pages/upgrade-requests.tsx |

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|---------|
| Site not loading | `pm2 restart all --update-env` |
| Agencies page 500 | `ALTER TABLE agencies ADD COLUMN IF NOT EXISTS last_payment_id text, ADD COLUMN IF NOT EXISTS last_payment_at timestamp, ADD COLUMN IF NOT EXISTS last_payment_amount integer;` then restart |
| Subscription not activating | Check RAZORPAY_KEY_SECRET in .env matches Razorpay webhook secret |
| Webhook not firing | Razorpay dashboard → Webhooks → both must be Enabled |
| Emails not sending | Check RESEND_API_KEY in .env; use `pm2 restart all --update-env` |
| Cron error: f is not a function | dotenv import must be FIRST line in server/index.ts, before email import |
| Cron shows 0 agencies checked | Run: `UPDATE agencies SET subscription_expiry = NOW() + INTERVAL '30 days' WHERE subscription_expiry IS NULL;` |
| App not picking up .env changes | Always use `pm2 restart all --update-env` not just `pm2 restart all` |
| SSL expired | `certbot renew && systemctl reload nginx` |
| DB connection failed | Check DATABASE_URL in .env |

---

## ⏳ PENDING TASKS

| Task | Priority |
|------|----------|
| RC API key (Surepass) — ₹25k deposit | 🔴 High |
| Onboard APLM + ICA with real users | 🔴 High |
| Add-on packs checkout (RC + AI credits) | 🟡 Medium |
| Payment history page | 🟡 Medium |
| Auto-reply support@icaweb.in | 🟡 Medium |

---

## 📋 Version History

| Version | Date | Changes |
|---------|------|---------|
| v7.0 | Mar 18, 2026 | Daily subscription cron live — 7-day/1-day reminders + auto-expire; fixed dotenv import order; added sendSubscriptionReminderEmail + sendSubscriptionExpiredEmail to email.ts |
| v6.0 | Mar 17, 2026 | Subscription expiry system, 30-day billing, Razorpay webhook auto-activate, renewal banner, subscription emails, DB migration |
| v5.0 | Mar 2026 | Marketing website, Razorpay live payments, privacy policy, edit agency limits |
| v4.0 | Mar 2026 | Resend email integration, plan upgrade email, VS Code SSH |
| v3.0 | Mar 2026 | RC Lookup UI, plan limits, WhatsApp, VPS deployment, SSL |
| v2.0 | Feb 2026 | Security hardening, AI Proceeding, performance engine |
| v1.0 | Jan 2026 | Initial release — lead management, 4 roles, JWT auth |

---

*Last updated: March 18, 2026 | v7.0 | Sameer | ICA — Innovation, Consulting & Automation*
