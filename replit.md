# ICA CRM - Enterprise Lead Management System

## Overview
Multi-tenant CRM platform for Insurance Consulting Associates (ICA) with role-based access control, lead management, performance tracking, AI Proceeding intelligence (real OpenAI Whisper + GPT), Excel import/export, services management, and plan upgrade workflow.

## Branding
- Logo: `attached_assets/ica-logo_1772293580977.jpg`
- Tagline: "Innovation, Consulting & Automation"
- Support: +91 9967969850
- Theme: Navy blue primary (hue 217)

## Architecture
- **Frontend**: React + Vite + TailwindCSS + Shadcn UI + Recharts
- **Backend**: Express.js with JWT authentication
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: JWT tokens (stored as `ica_token` in localStorage, 24h expiry) with bcryptjs password hashing
- **Excel**: xlsx package for import/export
- **AI**: OpenAI via Replit AI Integrations (speechToText with gpt-4o-mini-transcribe, GPT-4o-mini for analysis)
- **Security**: Rate limiting (express-rate-limit), auth-protected integration routes, sanitized error responses

## Role Hierarchy
1. **MASTER_ADMIN** - System-wide management, create agencies, assign plans, approve users (assign agency+role), approve upgrade requests, delete agencies (cascade), filter users by agency
2. **AGENCY_ADMIN** - Manage agency users, leads, services, AI Proceeding (PRO+), reports, approvals, request plan upgrades
3. **TEAM_LEADER** - Add/assign/delete leads to telecallers (only role that can assign), view team performance, sees only TELE_CALLER users
4. **TELE_CALLER** - Update assigned leads only, view personal KPIs

## Subscription Plans
- **BASIC** - Standard lead management
- **PRO** - AI Proceeding enabled (real Whisper transcription + GPT analysis)
- **ENTERPRISE** - AI + future custom modules

## Key Features
- Multi-tenant data isolation by agencyCode
- **Login page**: Split layout with left hero panel (ICA branding) and right form panel; Sign In + Sign Up tabs
- **Sign Up without agency code**: Users register with fullName, email, mobile, username, password → PENDING_APPROVAL → MASTER_ADMIN assigns agency+role during approval; AGENCY_ADMIN approves own-agency users
- Password management (change own, admin reset for subordinates)
- Lead management with status tracking (NEW, CONTACTED, FOLLOW_UP, CONVERTED, NOT_INTERESTED)
- **Lead search**: Search by name, phone, or email with debounced input (400ms) across all lead views
- **Lead assignment**: TEAM_LEADER only (backend enforced); service selection during assignment; assigned leads disappear from TEAM_LEADER's default view (Unassigned filter)
- **Lead deletion**: TEAM_LEADER only (same agency enforcement)
- **Bulk lead selection**: Checkboxes for multi-select, "Assign (N)" button for bulk assignment
- Bulk lead upload via Excel/CSV with template download
- **Services management**: AGENCY_ADMIN creates/deletes services; services shown in lead create/assign dialogs
- **Plan upgrade requests**: AGENCY_ADMIN submits request, MASTER_ADMIN approves/denies, auto-updates agency limits
- Performance scoring engine (conversion 40%, follow-up discipline 30%, activity 20%, overdue penalty 10%)
- **Optimized KPI queries**: Single SQL query with conditional aggregation instead of multiple round-trips
- **AI Proceeding**: Real OpenAI Whisper transcription + GPT-4o-mini structured insight extraction (summary, targets, achievements, KPIs, deadlines, risks, responsible persons); MASTER_ADMIN can view all agencies' proceedings with agency filter and delete them
- Excel export for leads, performance, and conversion reports
- **Audit logging**: Paginated (20 per page) with prev/next navigation; tracks lead status changes, password changes, user approvals
- Role-based routing and middleware
- **Dashboard**: Role-specific charts using Recharts (bar, pie, radar, stacked bar)
- **Notifications**: Bell icon in header showing role-specific alerts (overdue follow-ups, unassigned leads, pending approvals, upgrade requests) with auto-refresh every 60s
- **Rate limiting**: Login (10 attempts/15min), API (200 req/min)
- **Protected integration routes**: /api/conversations and /api/generate-image require JWT auth
- **JWT secret enforced**: SESSION_SECRET env var is required at startup (no hardcoded fallback)
- **Seed endpoint protected**: Disabled in production (NODE_ENV=production)
- **Response logging truncated**: API response logs capped at 200 chars to prevent data leakage
- **Template endpoint protected**: /api/leads/template requires auth + TEAM_LEADER/AGENCY_ADMIN role
- **Sanitized errors**: 500 responses return generic messages; actual errors logged server-side only
- **Database indexes**: On audit_logs (agency, lead, user, created_at) and meetings (agency, created_by)
- **Agency deletion**: MASTER_ADMIN cascade deletes (leads, users, services, meetings, audit logs, upgrade requests)
- **User visibility**: TEAM_LEADER sees only TELE_CALLER users; MASTER_ADMIN can filter by agency
- **Update button**: Only shown to TELE_CALLER (for assigned leads), TEAM_LEADER, and AGENCY_ADMIN
- **Query cache**: Cleared on login and logout to prevent cross-user data leakage; staleTime set to 30s
- **Lead status filter**: Works for all roles including TELE_CALLER (getLeadsByAssignee supports status param)

## Demo Credentials
- masteradmin / admin123
- agencyadmin / agency123 (agency code: ICA-DEMO01, PRO plan)
- teamlead1 / team123
- telecaller1 / caller123

## User Status Flow
- Sign up -> PENDING_APPROVAL -> Admin approves (MASTER_ADMIN assigns agency+role) -> ACTIVE
- Admin can deactivate -> INACTIVE

## Database Schema
- agencies, users, leads, audit_logs, meetings, services, upgradeRequests, conversations, messages
- Users have `status` field: ACTIVE, INACTIVE, PENDING_APPROVAL
- Users have `mobile` field (added in V3)
- Leads have `service` field (added in V3)
- Services: id, name, agencyCode, createdAt
- UpgradeRequests: id, agencyCode, currentPlan, requestedPlan, status, remarks, createdAt
- Meetings have `audioFileName` field for uploaded audio
- AuditLogs have `targetUserId` (nullable) and `leadId` (nullable); indexed on agency_code, lead_id, user_id, created_at
- Meetings indexed on agency_code, created_by
- Compound unique index on (agencyCode, phone) for leads

## Project Structure
- `shared/schema.ts` - Drizzle schema + Zod validation (re-exports conversations/messages from shared/models/chat.ts)
- `server/routes.ts` - API endpoints with auth/role middleware
- `server/storage.ts` - Database CRUD operations (includes deleteAgency, deleteLead, getTelecallersByAgency, getUsersByAgencyFilter, deleteServicesByAgency, getNotifications)
- `server/index.ts` - Express setup with rate limiting and integration route auth
- `server/db.ts` - PostgreSQL connection
- `server/replit_integrations/audio/client.ts` - OpenAI audio client (speechToText, ensureCompatibleFormat, openai)
- `client/src/lib/auth.tsx` - JWT auth context
- `client/src/hooks/use-api.ts` - Authenticated API fetch hook
- `client/src/pages/` - Dashboard, Agencies, Users, Leads, Performance, Meetings, Audit Logs, Approvals, Reports, Change Password, Services, Upgrade Requests
- `client/src/components/app-sidebar.tsx` - Role-based navigation with ICA branding

## API Endpoints
- POST /api/auth/login (rate limited: 10/15min), POST /api/auth/signup, GET /api/auth/me
- PATCH /api/users/change-password, PATCH /api/users/admin-reset-password
- POST /api/users/approve/:id, POST /api/users/reject/:id
- GET /api/users/pending
- GET /api/users (TEAM_LEADER: telecallers only; MASTER_ADMIN: ?agency= filter)
- CRUD /api/agencies (includes DELETE for cascade delete)
- CRUD /api/leads (includes DELETE for TEAM_LEADER, ?search= for name/phone/email search)
- POST /api/leads/bulk-assign (TEAM_LEADER only, bulk lead assignment)
- POST /api/leads/bulk, POST /api/leads/upload, GET /api/leads/template
- GET /api/reports/leads, /api/reports/performance, /api/reports/conversion
- GET /api/dashboard, /api/stats/leads
- GET /api/performance/telecaller
- POST /api/meetings (multipart with audio - real Whisper+GPT), GET /api/meetings
- CRUD /api/services (AGENCY_ADMIN)
- GET/POST /api/upgrade-requests, PATCH /api/upgrade-requests/:id (MASTER_ADMIN approve/deny)
- GET /api/audit-logs (?page=&limit= pagination)
- GET /api/notifications (role-specific alerts)
- POST /api/seed (initial data)
