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
ANTHROPIC_API_KEY=<real key added — Claude Haiku + Sonnet>
NODE_ENV=production
ALLOWED_ORIGINS=https://crm.icaweb.in,https://icaweb.in,https://www.icaweb.in
RESEND_API_KEY=<active — domain icaweb.in verified>
FROM_EMAIL=support@icaweb.in
RC_API_KEY=<pending — Surepass>
RAZORPAY_KEY_ID=<live key>
RAZORPAY_KEY_SECRET=<live secret>
ADDON_WEBHOOK_SECRET=<addon webhook secret from Razorpay>
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TailwindCSS + Shadcn UI |
| Backend | Express.js 5 + TypeScript |
| Database | PostgreSQL 16 + Drizzle ORM |
| AI Transcription | OpenAI Whisper + GPT-4o (AI Proceeding) |
| AI Suite | Anthropic Claude — Haiku (scoring/remarks) + Sonnet (chatbot) |
| Email | Resend API — domain icaweb.in (Verified) |
| Payments | Razorpay (live) — UPI, Cards, NetBanking, Wallets, EMI |
| Process Manager | PM2 cluster (2 instances) |
| Web Server | Nginx + SSL (Let's Encrypt) |
| Security | helmet.js + CORS + rate-limit + Zod validation |

---

## 👥 Roles & Access

| Role | Access |
|------|--------|
| MASTER_ADMIN | Full system — all agencies, users, plans, upgrade approvals, subscription management, payment history |
| AGENCY_ADMIN | Own agency — leads, users, AI Proceeding, RC lookup, reports, plan upgrades, AI Tools (PRO+), addon credits |
| TEAM_LEADER | Add leads, bulk upload, assign leads to telecallers, view team performance, AI Tools (PRO+) |
| TELE_CALLER | Own assigned leads only — update status, remarks, WhatsApp, inline AI buttons (PRO+) |

> TEAM_LEADER is the **only** role that can assign leads to telecallers.

---

## 💰 Pricing Plans (FINAL — LOCKED)

| Feature | BASIC ₹2,500/mo | PRO ₹5,500/mo | ENTERPRISE ₹12,000/mo |
|---------|:-:|:-:|:-:|
| Leads | Custom (set by admin) | Custom (set by admin) | Custom (set by admin) |
| Users | Custom (set by admin) | Custom (set by admin) | Custom (set by admin) |
| AI Proceeding | ❌ | 15/month | 40/month |
| RC Lookup | ❌ | 50/month | 200/month |
| AI Tools (Remarks + Follow-up + Scoring) | ❌ | ✅ | ✅ |
| Inline AI on Lead Cards | ❌ | ✅ | ✅ |
| AI Chatbot | ❌ | ❌ | ✅ |
| WhatsApp | ✅ | ✅ | ✅ |
| Automated Emails | ✅ | ✅ | ✅ |
| Subscription | 30 days/payment | 30 days/payment | 30 days/payment |

### Add-on Packs (Live on icaweb.in)

| Pack | Credits | Price | Per Unit |
|------|---------|-------|----------|
| RC Small | 10 RC Lookups | ₹99 | ₹9.90/lookup |
| RC Large | 25 RC Lookups | ₹199 | ₹7.96/lookup |
| AI Small | 5 AI Proceedings | ₹199 | ₹39.80/session |
| AI Large | 15 AI Proceedings | ₹499 | ₹33.27/session |

> Add-on packs available for PRO and ENTERPRISE plans only · Credits added instantly after payment

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
| Daily subscription cron | ✅ | setInterval in server/index.ts |
| Payment History page | ✅ | MASTER_ADMIN — all Razorpay transactions |
| AI Smart Remark Suggestions | ✅ | Claude Haiku — PRO + ENTERPRISE |
| AI Follow-up Message Generator | ✅ | Claude Haiku — WhatsApp + Call script |
| AI Lead Scoring | ✅ | Claude Haiku — 1-100 score + Hot/Warm/Cold |
| AI CRM Chatbot | ✅ | Claude Sonnet — ENTERPRISE only |
| AI Tools page | ✅ | /ai-tools — all roles |
| Inline AI buttons on lead cards | ✅ | ✨ sparkle button — TELE_CALLER + TEAM_LEADER |
| Add-on packs checkout | ✅ | RC + AI top-ups on icaweb.in with Razorpay |
| Add-on credit balance in CRM | ✅ | Plan & Upgrade page — RC + AI credits with Buy more link |

---

## 🤖 AI Suite — Feature Details

### API Endpoints
```
POST /api/ai/suggest-remark     → Smart remark after a call (Haiku)
POST /api/ai/followup-message   → WhatsApp / call script generator (Haiku)
POST /api/ai/score-lead         → Lead conversion score 1-100 (Haiku)
POST /api/ai/chat               → CRM AI assistant with live data (Sonnet)
```

### Models Used
- **Claude Haiku** (`claude-haiku-4-5-20251001`) — Remarks, Follow-up, Scoring (~₹0.001/call)
- **Claude Sonnet** (`claude-sonnet-4-6`) — Chatbot (~₹0.05/message)

---

## 🎁 Add-on Packs System

### How It Works
```
Agency hits RC/AI monthly limit
        ↓
Goes to icaweb.in → Add-on Packs section
        ↓
Selects pack → enters agency code → verifies → pays via Razorpay
        ↓
Webhook fires → credits added to agencies table instantly
        ↓
CRM Plan & Upgrade page shows updated balance
```

### DB Schema
```sql
-- New columns on agencies table
rc_addon_credits  integer  DEFAULT 0
ai_addon_credits  integer  DEFAULT 0

-- New table
addon_purchases (id, agency_code, pack_type, pack_size, amount, razorpay_order_id, razorpay_payment_id, status, created_at)
```

### API Endpoints
```
POST /api/addons/create-order   → Create Razorpay order for addon pack
POST /api/addons/verify         → Verify payment + credit agency
GET  /api/addons/balance        → Get current addon credits (public — uses agency code)
POST /api/addons/webhook        → Razorpay webhook auto-credit
```

### Razorpay Webhooks Registered
| URL | Purpose |
|-----|---------|
| /api/payments/webhook | Legacy payment verify |
| /api/subscription/webhook | Subscription auto-activate |
| /api/addons/webhook | Add-on pack credit on payment |

### Troubleshooting Add-on Packs
| Problem | Solution |
|---------|---------|
| "Could not verify" on icaweb.in | Check ALLOWED_ORIGINS includes https://icaweb.in in .env |
| "Failed to create order" | Check pm2 logs — usually db import issue |
| Credits not added after payment | Check ADDON_WEBHOOK_SECRET in .env matches Razorpay |

---

## 🔄 Subscription Lifecycle

```
Customer pays on icaweb.in or CRM
        ↓
Razorpay fires → /api/subscription/webhook
        ↓
Verify signature → find agency → set expiry = today + 30 days
        ↓
Day 23 → 7-day reminder email
Day 29 → 1-day urgent reminder
Day 30 → expired → banner in CRM → Renew button
        ↓
cron: daysLeft ≤ 0 → SET subscription_status='EXPIRED' → send expired email
        ↓
Customer pays → webhook fires → expiry + 30 more days
```

### Subscription API Endpoints
```
GET  /api/subscription/status    → plan, expiry, days left
POST /api/subscription/extend    → MASTER_ADMIN manual extend
POST /api/subscription/webhook   → Razorpay auto-activate
```

---

## ⏱️ Daily Cron

- Lives in `server/index.ts`
- `import "dotenv/config"` MUST be first import
- PM2 cluster safe — idempotent
- Fires 10 seconds after startup, then every 24 hours

```bash
pm2 logs ica-crm --lines 10
# Look for: [cron] Subscription cron done — X agencies checked
```

**To set subscription expiry for a new agency:**
```sql
UPDATE agencies SET subscription_status = 'ACTIVE',
    subscription_expiry = NOW() + INTERVAL '30 days'
WHERE agency_code = 'ICA-XXXXXX';
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

# Check addon credits
psql -U postgres -h localhost -d ica_crm -c \
  "SELECT name, agency_code, rc_addon_credits, ai_addon_credits FROM agencies;"

# Git tags / milestones
git tag -a vX.X -m "Description"
git push origin vX.X

# Rollback to a tag
git checkout vX.X
npm run build && pm2 restart all --update-env

# Return to latest
git checkout master
npm run build && pm2 restart all --update-env
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
| Leads page (inline AI) | client/src/pages/leads.tsx |
| AI Tools page | client/src/pages/ai-tools.tsx |
| Payment History page | client/src/pages/payment-history.tsx |
| Plan & Upgrade page | client/src/pages/upgrade-requests.tsx |
| Subscription banner | client/src/components/SubscriptionBanner.tsx |
| Sidebar nav | client/src/components/app-sidebar.tsx |
| Nginx (CRM) | /etc/nginx/sites-enabled/ica-crm |
| Nginx (website) | /etc/nginx/sites-enabled/icaweb-in |
| Marketing website | /var/www/icaweb-in/index.html |
| Privacy policy | /var/www/icaweb-in/privacy-policy.html |

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|---------|
| Site not loading | `pm2 restart all --update-env` |
| 502 Bad Gateway | `curl http://localhost:5000/api/auth/me` — if fails run `npm run build && pm2 restart all --update-env` |
| Build failed | `npm run build 2>&1 \| grep ERROR` — fix file then rebuild |
| Subscription not activating | Check RAZORPAY_KEY_SECRET in .env matches webhook secret |
| Emails not sending | Check RESEND_API_KEY in .env |
| AI returns 403 | Agency on BASIC plan — PRO or ENTERPRISE required |
| AI chatbot 403 | ENTERPRISE plan required |
| AI service error 500 | Check ANTHROPIC_API_KEY in .env → restart |
| Sparkle button not showing | Lead must be assigned to telecaller + hard refresh (Ctrl+Shift+R) |
| Addon verify fails on icaweb.in | Check ALLOWED_ORIGINS includes https://icaweb.in |
| Addon credits not added | Check ADDON_WEBHOOK_SECRET in .env matches Razorpay |
| SSL expired | `certbot renew && systemctl reload nginx` |

---

## 🏷️ Git Tags / Milestones

| Tag | Date | Description |
|-----|------|-------------|
| `v8.3` | Mar 19, 2026 | Add-on packs complete — icaweb.in checkout + CRM balance display |
| `v8.2` | Mar 19, 2026 | Add-on packs backend + icaweb.in section live |
| `v8.1` | Mar 18, 2026 | Inline AI buttons on lead cards |
| `v8.0` | Mar 18, 2026 | AI Suite launch — 4 features + Payment History |
| `v7.0` | Mar 18, 2026 | Daily subscription cron |
| `v6.0` | Mar 17, 2026 | Subscription system + Razorpay webhook |

**To rollback to any milestone:**
```bash
git checkout v8.3   # or any tag
npm run build && pm2 restart all --update-env

# Return to latest
git checkout master
npm run build && pm2 restart all --update-env
```

---

## ⏳ PENDING TASKS

| Task | Priority |
|------|----------|
| RC API key (Surepass) — ₹25k deposit | 🔴 High |
| Onboard APLM + ICA with real users | 🔴 High |
| Auto-reply support@icaweb.in | 🟡 Medium |

---

## 📋 Version History

| Version | Date | Changes |
|---------|------|---------|
| v8.3 | Mar 19, 2026 | Add-on credit balance on Plan & Upgrade page — RC + AI credits with Buy more link to icaweb.in |
| v8.2 | Mar 19, 2026 | Add-on packs backend (create-order, verify, balance, webhook) + icaweb.in checkout section live |
| v8.1 | Mar 18, 2026 | Inline AI buttons on lead cards — ✨ sparkle button with remark + WhatsApp generator |
| v8.0 | Mar 18, 2026 | AI Suite — Smart Remarks, Follow-up Generator, Lead Scoring (Haiku), CRM Chatbot (Sonnet). Payment History page. Git milestones. |
| v7.0 | Mar 18, 2026 | Daily subscription cron — 7-day/1-day reminders + auto-expire |
| v6.0 | Mar 17, 2026 | Subscription expiry system, 30-day billing, Razorpay webhook, renewal banner |
| v5.0 | Mar 2026 | Marketing website, Razorpay live payments, privacy policy, edit agency limits |
| v4.0 | Mar 2026 | Resend email integration, plan upgrade email, VS Code SSH |
| v3.0 | Mar 2026 | RC Lookup UI, plan limits, WhatsApp, VPS deployment, SSL |
| v2.0 | Feb 2026 | Security hardening, AI Proceeding, performance engine |
| v1.0 | Jan 2026 | Initial release — lead management, 4 roles, JWT auth |

---

*Last updated: March 19, 2026 | v8.3 | Sameer | ICA — Innovation, Consulting & Automation*