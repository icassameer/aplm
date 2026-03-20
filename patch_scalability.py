#!/usr/bin/env python3
"""
ICA CRM — Patch script for 3 scalability fixes:
1. getAllAgencies → paginated
2. getAllPayments → paginated
3. processingJobs 7-day auto-cleanup cron
Run from: /var/www/ica-crm
"""

import re, sys

# ═══════════════════════════════════════════════════════════════════
# FIX 1 + 2 — storage.ts: add paginated versions of agencies & payments
# ═══════════════════════════════════════════════════════════════════

storage_path = "server/storage.ts"
storage = open(storage_path).read()

# ── Add two new methods to IStorage interface ──
old_iface = "  getPerformanceStats(agencyCode: string, userId?: string): Promise<any>;"
new_iface = """  getAllAgencies(): Promise<Agency[]>;
  getAgenciesPaginated(page: number, limit: number): Promise<{ agencies: Agency[]; total: number }>;
  getPerformanceStats(agencyCode: string, userId?: string): Promise<any>;"""

# Only patch if not already patched
if "getAgenciesPaginated" not in storage:
    # interface already has getAllAgencies — add getAgenciesPaginated after it
    old_iface_line = "  getAllAgencies(): Promise<Agency[]>;"
    new_iface_line = """  getAllAgencies(): Promise<Agency[]>;
  getAgenciesPaginated(page: number, limit: number): Promise<{ agencies: Agency[]; total: number }>;"""
    storage = storage.replace(old_iface_line, new_iface_line, 1)
    print("✅ IStorage: added getAgenciesPaginated")
else:
    print("⏭  getAgenciesPaginated already in interface")

if "getPaymentsPaginated" not in storage:
    old_pay_iface = "  getAllPayments(): Promise<Payment[]>;"
    new_pay_iface = """  getAllPayments(): Promise<Payment[]>;
  getPaymentsPaginated(page: number, limit: number): Promise<{ payments: Payment[]; total: number }>;"""
    storage = storage.replace(old_pay_iface, new_pay_iface, 1)
    print("✅ IStorage: added getPaymentsPaginated")
else:
    print("⏭  getPaymentsPaginated already in interface")

# ── Add implementation: getAgenciesPaginated after getAllAgencies() impl ──
old_get_all = """  async getAllAgencies(): Promise<Agency[]> {
    return db.select().from(agencies).orderBy(desc(agencies.createdAt));
  }"""

new_get_all = """  async getAllAgencies(): Promise<Agency[]> {
    return db.select().from(agencies).orderBy(desc(agencies.createdAt));
  }

  async getAgenciesPaginated(page: number = 1, limit: number = 20): Promise<{ agencies: Agency[]; total: number }> {
    const offset = (page - 1) * limit;
    const [totalResult] = await db.select({ count: count() }).from(agencies);
    const result = await db.select().from(agencies).orderBy(desc(agencies.createdAt)).limit(limit).offset(offset);
    return { agencies: result, total: totalResult.count };
  }"""

if "getAgenciesPaginated" not in storage or "async getAgenciesPaginated" not in storage:
    if old_get_all in storage:
        storage = storage.replace(old_get_all, new_get_all, 1)
        print("✅ Impl: added getAgenciesPaginated()")
    else:
        print("⚠️  Could not find getAllAgencies impl — check manually")
else:
    print("⏭  getAgenciesPaginated impl already present")

# ── Add implementation: getPaymentsPaginated after getAllPayments() impl ──
old_get_pay = """  async getAllPayments(): Promise<Payment[]> {
    return db.select().from(payments).orderBy(desc(payments.createdAt));
  }"""

new_get_pay = """  async getAllPayments(): Promise<Payment[]> {
    return db.select().from(payments).orderBy(desc(payments.createdAt));
  }

  async getPaymentsPaginated(page: number = 1, limit: number = 20): Promise<{ payments: Payment[]; total: number }> {
    const offset = (page - 1) * limit;
    const [totalResult] = await db.select({ count: count() }).from(payments);
    const result = await db.select().from(payments).orderBy(desc(payments.createdAt)).limit(limit).offset(offset);
    return { payments: result, total: totalResult.count };
  }"""

if "getPaymentsPaginated" not in storage or "async getPaymentsPaginated" not in storage:
    if old_get_pay in storage:
        storage = storage.replace(old_get_pay, new_get_pay, 1)
        print("✅ Impl: added getPaymentsPaginated()")
    else:
        print("⚠️  Could not find getAllPayments impl — check manually")
else:
    print("⏭  getPaymentsPaginated impl already present")

open(storage_path, "w").write(storage)
print("✅ storage.ts saved\n")

# ═══════════════════════════════════════════════════════════════════
# FIX 1 + 2 — routes.ts: update GET /api/agencies and GET /api/payments
# ═══════════════════════════════════════════════════════════════════

routes_path = "server/routes.ts"
routes = open(routes_path).read()

# ── Patch GET /api/agencies ──
old_agencies_route = """  app.get("/api/agencies", authMiddleware, roleMiddleware("MASTER_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const allAgencies = await storage.getAllAgencies();
      res.json({ success: true, data: allAgencies });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });"""

new_agencies_route = """  app.get("/api/agencies", authMiddleware, roleMiddleware("MASTER_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const page  = parseInt(req.query.page  as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      // If ?all=true requested (e.g. dashboard needs full list for counts), return unpaginated
      if (req.query.all === "true") {
        const allAgencies = await storage.getAllAgencies();
        return res.json({ success: true, data: allAgencies });
      }
      const result = await storage.getAgenciesPaginated(page, limit);
      res.json({ success: true, data: result.agencies, total: result.total, page, limit });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });"""

if "getAgenciesPaginated" not in routes:
    if old_agencies_route in routes:
        routes = routes.replace(old_agencies_route, new_agencies_route, 1)
        print("✅ routes.ts: GET /api/agencies → paginated")
    else:
        print("⚠️  Could not find GET /api/agencies route — check manually")
else:
    print("⏭  GET /api/agencies already paginated")

# ── Patch GET /api/payments (all payments for MASTER_ADMIN) ──
old_payments_route = """  app.get("/api/payments/all", authMiddleware, roleMiddleware("MASTER_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const allPayments = await storage.getAllPayments();
      res.json({ success: true, data: allPayments });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });"""

new_payments_route = """  app.get("/api/payments/all", authMiddleware, roleMiddleware("MASTER_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const page  = parseInt(req.query.page  as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await storage.getPaymentsPaginated(page, limit);
      res.json({ success: true, data: result.payments, total: result.total, page, limit });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });"""

if "getPaymentsPaginated" not in routes:
    if old_payments_route in routes:
        routes = routes.replace(old_payments_route, new_payments_route, 1)
        print("✅ routes.ts: GET /api/payments/all → paginated")
    else:
        # Try alternate route name
        print("⚠️  Could not find GET /api/payments/all — searching for alternate...")
        # Search for any route that calls getAllPayments
        match = re.search(r'app\.get\("/api/payments[^"]*".*?getAllPayments.*?\}\);', routes, re.DOTALL)
        if match:
            print(f"   Found at: {routes[match.start():match.start()+80]}...")
        else:
            print("   Not found — will need manual check")
else:
    print("⏭  GET /api/payments already paginated")

open(routes_path, "w").write(routes)
print("✅ routes.ts saved\n")

# ═══════════════════════════════════════════════════════════════════
# FIX 3 — server/index.ts: add processingJobs 7-day cleanup to cron
# ═══════════════════════════════════════════════════════════════════

index_path = "server/index.ts"
index = open(index_path).read()

old_cron_end = """      log(`Subscription cron done — ${agencyRows.length} agencies checked`, "cron");
    } catch (err) {
      log(`Subscription cron error: ${err}`, "cron");
    }
  }"""

new_cron_end = """      log(`Subscription cron done — ${agencyRows.length} agencies checked`, "cron");

      // ── Clean up old processing jobs (older than 7 days) ──────────────────
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const cleaned = await db.execute(sql`
          DELETE FROM processing_jobs
          WHERE updated_at < ${sevenDaysAgo.toISOString()}
          AND status IN ('completed', 'failed')
        `);
        log(`Job cleanup done — old completed/failed jobs removed`, "cron");
      } catch (cleanErr) {
        log(`Job cleanup error: ${cleanErr}`, "cron");
      }

    } catch (err) {
      log(`Subscription cron error: ${err}`, "cron");
    }
  }"""

if "processing_jobs" not in index:
    if old_cron_end in index:
        index = index.replace(old_cron_end, new_cron_end, 1)
        print("✅ index.ts: added 7-day processingJobs cleanup to cron")
    else:
        print("⚠️  Could not find cron end marker — check manually")
else:
    print("⏭  processingJobs cleanup already in cron")

open(index_path, "w").write(index)
print("✅ index.ts saved\n")

print("=" * 50)
print("All patches applied. Now run:")
print("  npm run build && pm2 restart all --update-env")
print("=" * 50)
