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
| **GitHub** | https://github.com/icassameer/icacrmweb.in |
| **Branch** | `master` |
| **Server IP** | 203.174.22.119 |
| **Server Name** | crmicawebin (HostBet) |
| **SSH** | `ssh root@203.174.22.119` (port 22) |
| **Root Password** | Icacrm@321 |
| **Working Dir** | /var/www/ica-crm |
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
| **Password** | IcaDb#Secure2026 |
| **URL** | postgresql://postgres:IcaDb#Secure2026@localhost:5432/ica_crm |
| **ORM** | Drizzle ORM |

> ⚠️ DB password was rotated March 2026 after .env exposure incident. Use `sudo -u postgres psql` to access.

---

## ⚙️ Server .env

```
SESSION_SECRET=<rotated March 2026 — check server>
DATABASE_URL=postgresql://postgres:IcaDb#Secure2026@localhost:5432/ica_crm
OPENAI_API_KEY=<real key added>
NODE_ENV=production
ALLOWED_ORIGINS=https://crm.icaweb.in
RESEND_API_KEY=<rotated March 2026 — check server>
FROM_EMAIL=support@icaweb.in
RC_API_KEY=<pending — Surepass>
SARVAM_API_KEY=<active — dashboard.sarvam.ai>
```

> ⚠️ SESSION_SECRET and RESEND_API_KEY were rotated in March 2026. Always use `cat /var/www/ica-crm/.env` on server for current values.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TailwindCSS + Shadcn UI |
| Backend | Express.js 5 + TypeScript |
| Database | PostgreSQL 16 + Drizzle ORM |
| AI Transcription | Sarvam Saaras v3 (Hindi/Marathi) + OpenAI Whisper (English/auto) |
| AI Analysis | GPT-4o (insights extraction + speaker diarization) |
| Email | Resend API — domain icaweb.in (Verified ✓) |
| Process Manager | PM2 cluster (2 instances) |
| Web Server | Nginx + SSL (Let's Encrypt) |
| Security | helmet.js + CORS + rate-limit + Zod validation |

---

## 👥 Roles & Access

| Role | Access |
|------|--------|
| MASTER_ADMIN | Full system — all agencies, users, plans, upgrade approvals |
| AGENCY_ADMIN | Own agency — leads, users, AI Proceeding, RC lookup, reports, request upgrades |
| TEAM_LEADER | Add leads, bulk upload, assign leads to telecallers, view team performance |
| TELE_CALLER | Own assigned leads only — add/edit/call/WhatsApp/update status |

> ⚠️ TEAM_LEADER is the **only** role that can assign leads to telecallers.

---

## 💰 Pricing Plans (FINAL)

| Feature | BASIC ₹2,500/mo | PRO ₹5,500/mo | ENTERPRISE ₹15,000/mo |
|---------|:-:|:-:|:-:|
| Leads | 500 | 1,000 | Unlimited |
| Users | 5 | 10 | Unlimited |
| AI Proceeding | ❌ | 10/month | Unlimited |
| RC Lookup | ❌ | 100/month | Unlimited |
| WhatsApp | ✅ | ✅ | ✅ |
| Automated Emails | ✅ | ✅ | ✅ |
| Reports | Basic | Advanced | Full Analytics |
| Support | Email | Email + Chat | Dedicated Manager |

---

## ✅ COMPLETED FEATURES

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-role auth (JWT) | ✅ | 4 roles |
| Lead management | ✅ | CRUD + bulk upload |
| WhatsApp click-to-chat | ✅ | With lead name + service |
| AI Proceeding | ✅ | GPT-4o + Whisper background processing |
| Speaker diarization | ✅ | Multi-speaker labeling |
| Multilingual transcription | ✅ | Language selector (Hindi/Marathi/English) |
| RC Lookup UI | ✅ | Frontend ready, API key pending |
| Plan limits enforcement | ✅ | Leads, users, AI, RC per plan |
| Performance reports | ✅ | |
| Audit logs | ✅ | |
| DB-backed job processing | ✅ | Fixes PM2 cluster job sharing |
| VPS deployment | ✅ | HostBet Micro |
| Nginx + SSL | ✅ | https://crm.icaweb.in |
| GitHub | ✅ | Branch: master |
| Resend email integration | ✅ | Welcome, prospect, plan upgrade emails |
| Plan upgrade email | ✅ | Auto-fires on MASTER_ADMIN approval |
| VS Code Remote SSH | ✅ | Configured on new PC |
| fontSrc CSP fix | ✅ | Duplicate helmet directive removed |
| .gitignore cleanup | ✅ | .env.save* excluded |
| .env Nginx block | ✅ | Returns 404 — no public access |
| Welcome email fix | ✅ | Sent only on direct MASTER_ADMIN creation |
| DB password rotation | ✅ | March 2026 security incident response |
| Resend API key rotation | ✅ | March 2026 security incident response |
| Sarvam AI integration | ✅ | Hindi/Marathi transcription — 25sec chunks |
| Chunked transcription | ✅ | Supports 2hr+ meetings, auto-splits audio |
| Generic AI prompts | ✅ | Not insurance-specific — works for any business |
| 500MB upload limit | ✅ | Was 50MB — handles full day recordings |

---

## ⏳ PENDING TASKS

| Task | Priority | Notes |
|------|----------|-------|
| RC API key (Surepass) | 🔴 High | ₹2.25/hit, min ₹25k deposit |
| Update plan pricing in DB | 🔴 High | PRO=5500, ENTERPRISE=15000 |
| Make GitHub repo private | 🔴 High | Currently public — exposes codebase |
| Privacy policy page | 🟡 Medium | /privacy-policy route |
| Auto-reply on support@icaweb.in | 🟡 Medium | Acknowledge incoming emails |
| AI Proceeding accuracy | 🟡 Medium | Marathi/Hindi improvement |
| Exotel voice integration | 🟡 Medium | Phase 2 |

---

## 🎙️ AI Transcription Architecture

| Language | Engine | Chunk Size | Accuracy |
|----------|--------|-----------|---------|
| Marathi (mr) | Sarvam Saaras v3 | 25 sec chunks | ~90%+ |
| Hindi (hi) | Sarvam Saaras v3 | 25 sec chunks | ~95%+ |
| Gujarati, Tamil, Telugu, Kannada, Bengali, Punjabi, Urdu | Sarvam Saaras v3 | 25 sec chunks | High |
| English (en) | OpenAI Whisper-1 | 10 min chunks | ~95%+ |
| Auto detect | OpenAI Whisper-1 | 10 min chunks | Varies |

> ⚠️ Always select language manually for best accuracy — never use Auto Detect for Hindi/Marathi.
> Sarvam API key managed at: https://dashboard.sarvam.ai
> Sarvam free tier: 30 sec/request → handled via chunking

### Audio Upload Recommendations
- **Format:** MP3, WAV, MP4, M4A
- **Bitrate:** Minimum 128kbps
- **Max file size:** 500MB
- **Max duration:** 2hr+ (auto-chunked)
- **Phone call recordings:** Convert MPEG → MP3 at 128kbps before upload

---



| Email Type | Trigger | Recipient |
|-----------|---------|-----------|
| Welcome Email | MASTER_ADMIN **directly creates** Agency Admin via Add Member | New AGENCY_ADMIN |
| Prospect Inquiry | Manual via `/api/email/prospect` | Prospective client |
| Plan Upgrade | MASTER_ADMIN approves upgrade request | Agency admin |
| Password Reset | Not automated — share manually via WhatsApp | N/A |

> ⚠️ **Important:** Welcome email fires on `POST /api/users` (direct creation) — NOT on the signup approval flow (`POST /api/users/approve/:id`). This is by design to avoid duplicate emails with the 2-instance PM2 cluster.

> Domain `icaweb.in` is **verified** on Resend. All emails sent from `support@icaweb.in`.

### Manual Email API Endpoints (MASTER_ADMIN only)
```bash
POST /api/email/prospect   # Send prospect inquiry email
POST /api/email/welcome    # Send welcome email manually
```

---

## 🚀 Common Server Commands

```bash
# SSH
ssh root@203.174.22.119

# Navigate
cd /var/www/ica-crm

# Status
pm2 status

# Logs
pm2 logs ica-crm --lines 50

# Deploy latest
git pull origin master && npm run build && pm2 restart all

# Edit .env (always use --update-env after changing .env)
nano /var/www/ica-crm/.env && pm2 restart all --update-env

# DB access
sudo -u postgres psql -d ica_crm

# SSL renew
certbot renew

# Test Resend API
curl -s https://api.resend.com/emails \
  -H "Authorization: Bearer $(grep RESEND_API_KEY /var/www/ica-crm/.env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"from":"support@icaweb.in","to":"test@gmail.com","subject":"Test","html":"<p>Test</p>"}'
```

---

## 🖥️ VS Code Remote SSH Setup (New PC)

```
1. Install "Remote - SSH" extension (by Microsoft)
2. Ctrl+Shift+P → Remote-SSH: Open SSH Configuration File
3. Add:
   Host ICA-CRM
       HostName 203.174.22.119
       User root
       Port 22
4. Connect → enter password: Icacrm@321
5. Open Folder → /var/www/ica-crm
```

---

## 🔐 Security Implementation

| Control | Status |
|---------|--------|
| helmet.js (CSP, HSTS, noSniff, referrer) | ✅ Active — fontSrc duplicate fixed |
| CORS restricted to crm.icaweb.in | ✅ Active |
| Rate limiting (login 10/15min, API 200/min) | ✅ Active |
| Zod input validation | ✅ Active |
| JWT secret enforced (32+ chars) | ✅ Active |
| Seed endpoint blocked in production | ✅ Active |
| Audit logs for all sensitive actions | ✅ Active |
| .env.save* excluded from git | ✅ Fixed |
| .env blocked in Nginx (returns 404) | ✅ Fixed March 2026 |
| SESSION_SECRET rotated | ✅ March 2026 |
| DB password rotated | ✅ March 2026 |
| Resend API key rotated | ✅ March 2026 |

> ⚠️ **Incident — March 2026:** `/api/.env` was publicly accessible (returned 200). Credentials exposed. All secrets rotated. Nginx block added. GitHub repo should be made **private** immediately.

---

## 📁 Key File Locations

| File | Path |
|------|------|
| Backend routes | server/routes.ts |
| Email functions | server/email.ts |
| DB schema | shared/schema.ts |
| Storage layer | server/storage.ts |
| Audio/AI client | server/replit_integrations/audio/client.ts |
| Frontend pages | client/src/pages/ |
| Approvals page | client/src/pages/approvals.tsx |
| Sidebar nav | client/src/components/app-sidebar.tsx |
| PM2 config | ecosystem.config.cjs |
| Nginx config | /etc/nginx/sites-enabled/ica-crm |
| SSL certs | /etc/letsencrypt/live/crm.icaweb.in/ |

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|---------|
| Site not loading | `pm2 status` → `pm2 restart all` |
| Login failing (CORS) | Check ALLOWED_ORIGINS in .env |
| App crashing (SESSION_SECRET) | Ensure SESSION_SECRET is 32+ chars |
| AI Proceeding job not found | DB-backed jobs fix deployed — check pm2 status |
| Nginx 502 Bad Gateway | `pm2 restart all`, check `pm2 logs` |
| SSL expired | `certbot renew` → `systemctl reload nginx` |
| DB connection failed | Check DATABASE_URL in .env; use `sudo -u postgres psql` not `psql -U postgres` |
| Emails not sending | Check RESEND_API_KEY in .env, test with curl command above |
| Git push rejected | Use Personal Access Token, not password |
| .env exposed (returns 200) | Add Nginx location block to deny .env files |
| Sarvam transcription failing | Check SARVAM_API_KEY in .env; verify at dashboard.sarvam.ai |
| Bengali/gibberish in transcript | Audio corrupted by ffmpeg filters — check ensureCompatibleFormat |
| Transcript has repetitions | removeRepetitions() handles this — check pm2 logs for details |

---

## 📦 RC API (Pending)
- Provider: Surepass — ₹2.25/hit, min ₹25,000 deposit
- Once received: Add `RC_API_KEY` to .env → `pm2 restart all --update-env`

## 📞 Exotel Voice (Phase 2)
- Plan: Believer — ₹23,599 GST incl., 12 months, 6 agents, ₹9.5k balance
- Call rate: 60 paise/minute

---

## 🔮 Future Roadmap

| Phase | Feature | Timeline |
|-------|---------|---------|
| Immediate | RC Lookup go-live (Surepass key) | Pending payment |
| Immediate | Privacy policy page /privacy-policy | 1-2 weeks |
| Immediate | Auto-reply on support@icaweb.in | 1-2 weeks |
| Immediate | Make GitHub repo private | ASAP |
| Phase 2 | Exotel voice call integration | 1-3 months |
| Phase 2 | WhatsApp Business API | 1-3 months |
| Phase 2 | Mobile app (React Native) | 1-3 months |
| Phase 3 | Payment gateway (auto billing) | 3-6 months |
| Phase 3 | Custom domain per agency | 3-6 months |
| Phase 3 | Multi-language UI (Hindi) | 3-6 months |

---

## 📋 Version History

| Version | Date | Changes |
|---------|------|---------|
| v4.2 | March 2026 | Sarvam AI integration (Hindi/Marathi), chunked transcription (2hr+ support), 500MB upload, generic AI prompts, repetition removal |
| v4.1 | March 2026 | Security hardening (.env block, credential rotation), welcome email fix (direct creation only, no duplicates), DB password rotation |
| v4.0 | March 2026 | Resend email integration, plan upgrade email, VS Code SSH, fontSrc fix, .gitignore cleanup, TEAM_LEADER role correction |
| v3.0 | March 2026 | RC Lookup UI, plan limits, WhatsApp, VPS deployment, Nginx + SSL |
| v2.0 | Feb 2026 | Security hardening, AI Proceeding, performance engine |
| v1.0 | Jan 2026 | Initial release — lead management, 4 roles, JWT auth |

---

*Last updated: March 2026 v4.2 | Sameer | ICA — Innovation, Consulting & Automation*