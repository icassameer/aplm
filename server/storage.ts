import { eq, and, or, desc, asc, count, sql, ilike, isNull, isNotNull, lt, gt } from "drizzle-orm";
import { db } from "./db";
import {
  agencies, users, leads, auditLogs, meetings, services, upgradeRequests, rcRecords, processingJobs, payments,
  attendance, commissions,
  type Agency, type InsertAgency,
  type User, type InsertUser,
  type Lead, type InsertLead,
  type AuditLog, type Meeting, type InsertMeeting,
  type Service, type InsertService,
  type UpgradeRequest, type InsertUpgradeRequest,
  type RcRecord, type InsertRcRecord,
  type ProcessingJob,
  type Payment, type InsertPayment,
  type Attendance, type InsertAttendance,
  type Commission, type InsertCommission,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsersByAgency(agencyCode: string): Promise<User[]>;
  getTelecallersByAgency(agencyCode: string): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  getUsersByAgencyFilter(agencyCode?: string): Promise<User[]>;
  getPendingUsersByAgency(agencyCode: string): Promise<User[]>;
  getAllPendingUsers(): Promise<User[]>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  countUsersByAgency(agencyCode: string): Promise<number>;

  createAgency(agency: InsertAgency): Promise<Agency>;
  getAgency(id: string): Promise<Agency | undefined>;
  getAgencyByCode(code: string): Promise<Agency | undefined>;
  getAllAgencies(): Promise<Agency[]>;
  getAgenciesPaginated(page: number, limit: number): Promise<{ agencies: Agency[]; total: number }>;
  updateAgency(id: string, data: Partial<Agency>): Promise<Agency | undefined>;
  updateAgencyByCode(agencyCode: string, data: Partial<Agency>): Promise<Agency | undefined>;
  deleteAgency(id: string): Promise<void>;
  getExpiredAgencies(now: Date): Promise<Agency[]>;
  getAgenciesExpiringBefore(targetDate: Date, now: Date): Promise<Agency[]>;

  createLead(lead: InsertLead): Promise<Lead>;
  getLead(id: string): Promise<Lead | undefined>;
  getLeadsByAgency(agencyCode: string, page: number, limit: number, status?: string, assignmentFilter?: string, search?: string): Promise<{ leads: Lead[]; total: number }>;
  getLeadsByAssignee(assignedTo: string, page: number, limit: number, status?: string, search?: string): Promise<{ leads: Lead[]; total: number }>;
  updateLead(id: string, data: Partial<Lead>): Promise<Lead | undefined>;
  deleteLead(id: string): Promise<void>;
  countLeadsByAgency(agencyCode: string): Promise<number>;
  getLeadStats(agencyCode: string, assignedTo?: string): Promise<Record<string, number>>;

  createAuditLog(log: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog>;
  getAuditLogs(agencyCode: string, page: number, limit: number, leadId?: string): Promise<{ logs: AuditLog[]; total: number }>;

  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  getMeetingsByAgency(agencyCode: string): Promise<Meeting[]>;
  getAllMeetings(): Promise<Meeting[]>;
  getMeeting(id: string): Promise<Meeting | undefined>;
  deleteMeeting(id: string): Promise<void>;
  countMeetingsThisMonth(agencyCode: string): Promise<number>;

  getPerformanceStats(agencyCode: string, userId?: string): Promise<any>;

  createService(service: InsertService): Promise<Service>;
  getServicesByAgency(agencyCode: string): Promise<Service[]>;
  deleteService(id: string): Promise<void>;
  deleteServicesByAgency(agencyCode: string): Promise<void>;

  createUpgradeRequest(request: InsertUpgradeRequest): Promise<UpgradeRequest>;
  getUpgradeRequestsByAgency(agencyCode: string): Promise<UpgradeRequest[]>;
  getAllUpgradeRequests(): Promise<UpgradeRequest[]>;
  updateUpgradeRequest(id: string, data: Partial<UpgradeRequest>): Promise<UpgradeRequest | undefined>;
  getUpgradeRequest(id: string): Promise<UpgradeRequest | undefined>;

  createRcRecord(record: InsertRcRecord): Promise<RcRecord>;
  getRcRecordsByAgency(agencyCode: string): Promise<RcRecord[]>;
  getAllRcRecords(): Promise<RcRecord[]>;
  deleteRcRecord(id: string): Promise<void>;
  getRcRecordByNumber(agencyCode: string, rcNumber: string): Promise<RcRecord | undefined>;

  createPayment(data: InsertPayment): Promise<Payment>;
  getPaymentByOrderId(orderId: string): Promise<Payment | undefined>;
  getPaymentsByAgency(agencyCode: string): Promise<Payment[]>;
  updatePayment(orderId: string, data: Partial<Payment>): Promise<Payment | undefined>;
  getAllPayments(): Promise<Payment[]>;
  getPaymentsPaginated(page: number, limit: number): Promise<{ payments: Payment[]; total: number }>;
  createPaymentRecord(data: InsertPayment): Promise<Payment>;

  createJob(id: string, message: string): Promise<void>;
  updateJob(id: string, status: string, progress: number, message: string, result?: any, error?: string): Promise<void>;
  getJob(id: string): Promise<ProcessingJob | undefined>;
  deleteJob(id: string): Promise<void>;

  getNotifications(userId: string, role: string, agencyCode: string | null): Promise<any[]>;
  // v9.4 — Attendance
  punchIn(data: InsertAttendance): Promise<Attendance>;
  getTodayAttendance(userId: string, date: string): Promise<Attendance | undefined>;
  getAttendanceByUser(userId: string, agencyCode: string): Promise<Attendance[]>;
  getAttendanceByAgency(agencyCode: string, date?: string): Promise<Attendance[]>;
  updateAttendance(id: string, data: Partial<Attendance>): Promise<Attendance | undefined>;
  // v9.4 — Commissions
  createCommission(data: InsertCommission): Promise<Commission>;
  getCommissionsByUser(userId: string, agencyCode: string): Promise<Commission[]>;
  getCommissionsByAgency(agencyCode: string): Promise<Commission[]>;
  updateCommission(id: string, data: Partial<Commission>): Promise<Commission | undefined>;
  // v9.4 — Service commission
  updateService(id: string, data: Partial<Service>): Promise<Service | undefined>;
  getServiceByName(agencyCode: string, name: string): Promise<Service | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async getUsersByAgency(agencyCode: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.agencyCode, agencyCode)).orderBy(desc(users.createdAt));
  }

  async getTelecallersByAgency(agencyCode: string): Promise<User[]> {
    return db.select().from(users).where(
      and(eq(users.agencyCode, agencyCode), eq(users.role, "TELE_CALLER"))
    ).orderBy(desc(users.createdAt));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUsersByAgencyFilter(agencyCode?: string): Promise<User[]> {
    if (agencyCode) {
      return db.select().from(users).where(eq(users.agencyCode, agencyCode)).orderBy(desc(users.createdAt));
    }
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getPendingUsersByAgency(agencyCode: string): Promise<User[]> {
    return db.select().from(users).where(
      and(eq(users.agencyCode, agencyCode), eq(users.status, "PENDING_APPROVAL"))
    ).orderBy(desc(users.createdAt));
  }

  async getAllPendingUsers(): Promise<User[]> {
    return db.select().from(users).where(eq(users.status, "PENDING_APPROVAL")).orderBy(desc(users.createdAt));
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(auditLogs).where(eq(auditLogs.userId, id));
      await tx.delete(leads).where(eq(leads.assignedTo, id));
      await tx.delete(meetings).where(eq(meetings.createdBy, id));
      await tx.delete(users).where(eq(users.id, id));
    });
  }

  async countUsersByAgency(agencyCode: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(users).where(eq(users.agencyCode, agencyCode));
    return result.count;
  }

  async createAgency(agency: InsertAgency): Promise<Agency> {
    const [created] = await db.insert(agencies).values(agency).returning();
    return created;
  }

  async getAgency(id: string): Promise<Agency | undefined> {
    const [agency] = await db.select().from(agencies).where(eq(agencies.id, id));
    return agency;
  }

  async getAgencyByCode(code: string): Promise<Agency | undefined> {
    const [agency] = await db.select().from(agencies).where(eq(agencies.agencyCode, code));
    return agency;
  }

  async getAllAgencies(): Promise<Agency[]> {
    return db.select().from(agencies).orderBy(desc(agencies.createdAt));
  }

  async getAgenciesPaginated(page: number = 1, limit: number = 20): Promise<{ agencies: Agency[]; total: number }> {
    const offset = (page - 1) * limit;
    const [totalResult] = await db.select({ count: count() }).from(agencies);
    const result = await db.select().from(agencies).orderBy(desc(agencies.createdAt)).limit(limit).offset(offset);
    return { agencies: result, total: totalResult.count };
  }

  async updateAgency(id: string, data: Partial<Agency>): Promise<Agency | undefined> {
    const [updated] = await db.update(agencies).set(data).where(eq(agencies.id, id)).returning();
    return updated;
  }

  async updateAgencyByCode(agencyCode: string, data: Partial<Agency>): Promise<Agency | undefined> {
    const [updated] = await db.update(agencies).set(data).where(eq(agencies.agencyCode, agencyCode)).returning();
    return updated;
  }

  async deleteAgency(id: string): Promise<void> {
    const agency = await this.getAgency(id);
    if (!agency) return;
    await db.transaction(async (tx) => {
      await tx.delete(leads).where(eq(leads.agencyCode, agency.agencyCode));
      await tx.delete(services).where(eq(services.agencyCode, agency.agencyCode));
      await tx.delete(upgradeRequests).where(eq(upgradeRequests.agencyCode, agency.agencyCode));
      await tx.delete(meetings).where(eq(meetings.agencyCode, agency.agencyCode));
      await tx.delete(auditLogs).where(eq(auditLogs.agencyCode, agency.agencyCode));
      await tx.delete(users).where(eq(users.agencyCode, agency.agencyCode));
      await tx.delete(agencies).where(eq(agencies.id, id));
    });
  }

  async getExpiredAgencies(now: Date): Promise<Agency[]> {
    return db.select().from(agencies).where(
      and(
        lt(agencies.subscriptionExpiry, now),
        eq(agencies.subscriptionStatus, "ACTIVE")
      )
    );
  }

  async getAgenciesExpiringBefore(targetDate: Date, now: Date): Promise<Agency[]> {
    return db.select().from(agencies).where(
      and(
        lt(agencies.subscriptionExpiry, targetDate),
        gt(agencies.subscriptionExpiry, now),
        eq(agencies.subscriptionStatus, "ACTIVE")
      )
    );
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const [created] = await db.insert(leads).values(lead).returning();
    return created;
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async getLeadsByAgency(agencyCode: string, page: number = 1, limit: number = 20, status?: string, assignmentFilter?: string, search?: string): Promise<{ leads: Lead[]; total: number }> {
    const offset = (page - 1) * limit;
    const conditions = [eq(leads.agencyCode, agencyCode)];
    if (status && status !== "ALL") conditions.push(eq(leads.status, status));
    if (assignmentFilter === "UNASSIGNED") conditions.push(isNull(leads.assignedTo));
    else if (assignmentFilter === "ASSIGNED") conditions.push(isNotNull(leads.assignedTo));
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(or(ilike(leads.name, term), ilike(leads.phone, term), ilike(leads.email, term))!);
    }
    const where = and(...conditions);
    const [totalResult] = await db.select({ count: count() }).from(leads).where(where);
    const result = await db.select().from(leads).where(where).orderBy(status === "FOLLOW_UP" ? asc(leads.followUpDate) : desc(leads.createdAt)).limit(limit).offset(offset);
    return { leads: result, total: totalResult.count };
  }

  async getLeadsByAssignee(assignedTo: string, page: number = 1, limit: number = 20, status?: string, search?: string): Promise<{ leads: Lead[]; total: number }> {
    const offset = (page - 1) * limit;
    const conditions = [eq(leads.assignedTo, assignedTo)];
    if (status && status !== "ALL") conditions.push(eq(leads.status, status));
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(or(ilike(leads.name, term), ilike(leads.phone, term), ilike(leads.email, term))!);
    }
    const where = and(...conditions);
    const [totalResult] = await db.select({ count: count() }).from(leads).where(where);
    const result = await db.select().from(leads).where(where).orderBy(status === "FOLLOW_UP" ? asc(leads.followUpDate) : desc(leads.createdAt)).limit(limit).offset(offset);
    return { leads: result, total: totalResult.count };
  }

  async updateLead(id: string, data: Partial<Lead>): Promise<Lead | undefined> {
    const [updated] = await db.update(leads).set({ ...data, updatedAt: new Date() }).where(eq(leads.id, id)).returning();
    return updated;
  }

  async deleteLead(id: string): Promise<void> {
    await db.delete(auditLogs).where(eq(auditLogs.leadId, id));
    await db.delete(leads).where(eq(leads.id, id));
  }

  async countLeadsByAgency(agencyCode: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(leads).where(eq(leads.agencyCode, agencyCode));
    return result.count;
  }

  async getLeadStats(agencyCode: string, assignedTo?: string): Promise<Record<string, number>> {
    const conditions = [eq(leads.agencyCode, agencyCode)];
    if (assignedTo) conditions.push(eq(leads.assignedTo, assignedTo));
    const where = and(...conditions);
    const result = await db.select({ status: leads.status, count: count() }).from(leads).where(where).groupBy(leads.status);
    const stats: Record<string, number> = { NEW: 0, CONTACTED: 0, FOLLOW_UP: 0, CONVERTED: 0, NOT_INTERESTED: 0 };
    result.forEach(r => { stats[r.status] = r.count; });
    return stats;
  }

  async createAuditLog(log: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  async getAuditLogs(agencyCode: string, page: number = 1, limit: number = 20, leadId?: string): Promise<{ logs: AuditLog[]; total: number }> {
    const offset = (page - 1) * limit;
    const conditions = [eq(auditLogs.agencyCode, agencyCode)];
    if (leadId) conditions.push(eq(auditLogs.leadId, leadId));
    const where = and(...conditions);
    const [totalResult] = await db.select({ count: count() }).from(auditLogs).where(where);
    const logs = await db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset);
    return { logs, total: totalResult.count };
  }

  async createMeeting(meeting: InsertMeeting): Promise<Meeting> {
    const [created] = await db.insert(meetings).values(meeting).returning();
    return created;
  }

  async getMeetingsByAgency(agencyCode: string): Promise<Meeting[]> {
    return db.select().from(meetings).where(eq(meetings.agencyCode, agencyCode)).orderBy(desc(meetings.createdAt));
  }

  async getAllMeetings(): Promise<Meeting[]> {
    return db.select().from(meetings).orderBy(desc(meetings.createdAt));
  }

  async getMeeting(id: string): Promise<Meeting | undefined> {
    const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id));
    return meeting;
  }

  async deleteMeeting(id: string): Promise<void> {
    await db.delete(meetings).where(eq(meetings.id, id));
  }

  async countMeetingsThisMonth(agencyCode: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [result] = await db
      .select({ count: count() })
      .from(meetings)
      .where(
        and(
          eq(meetings.agencyCode, agencyCode),
          sql`${meetings.createdAt} >= ${startOfMonth.toISOString()}`
        )
      );
    return result?.count ?? 0;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PERFORMANCE STATS v2 — Smart 5-metric formula
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async getPerformanceStats(agencyCode: string, userId?: string): Promise<any> {
    const now = new Date();

    // ── 1. Lead counts by status ────────────────────────────────────────────
    const conditions = [eq(leads.agencyCode, agencyCode)];
    if (userId) conditions.push(eq(leads.assignedTo, userId));
    const where = and(...conditions);

    const [stats] = await db.select({
      totalLeads:       count(),
      newLeads:         sql<number>`count(CASE WHEN ${leads.status} = 'NEW'            THEN 1 END)`.mapWith(Number),
      converted:        sql<number>`count(CASE WHEN ${leads.status} = 'CONVERTED'      THEN 1 END)`.mapWith(Number),
      notInterested:    sql<number>`count(CASE WHEN ${leads.status} = 'NOT_INTERESTED' THEN 1 END)`.mapWith(Number),
      followUps:        sql<number>`count(CASE WHEN ${leads.status} = 'FOLLOW_UP'      THEN 1 END)`.mapWith(Number),
      overdueFollowUps: sql<number>`count(CASE WHEN ${leads.status} = 'FOLLOW_UP' AND ${leads.followUpDate} < NOW() THEN 1 END)`.mapWith(Number),
    }).from(leads).where(where);

    const total            = stats.totalLeads      ?? 0;
    const newLeads         = stats.newLeads         ?? 0;
    const converted        = stats.converted        ?? 0;
    const notInterested    = stats.notInterested    ?? 0;
    const followUps        = stats.followUps        ?? 0;
    const overdueFollowUps = stats.overdueFollowUps ?? 0;

    // ── 2. Speed to contact ─────────────────────────────────────────────────
    // Use updatedAt - createdAt for all non-NEW leads (no extra columns needed)
    // Cap at 72h per lead so outliers don't destroy the average
    const workedConditions = [
      eq(leads.agencyCode, agencyCode),
      sql`${leads.status} != 'NEW'`,
    ];
    if (userId) workedConditions.push(eq(leads.assignedTo, userId));

    const workedLeads = await db.select({
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
    }).from(leads).where(and(...workedConditions));

    let avgContactHours = 72; // worst-case default (no worked leads)
    if (workedLeads.length > 0) {
      const hours = workedLeads.map(l => {
        const contactTime = l.firstContactedAt?.getTime() ?? l.updatedAt?.getTime() ?? now.getTime();
        const diffMs = contactTime - (l.createdAt?.getTime() ?? now.getTime());
        return Math.min(Math.max(0, diffMs / 3_600_000), 72);
      });
      avgContactHours = hours.reduce((a, b) => a + b, 0) / hours.length;
    }

    // ── 3. Five metrics (each 0–100) ────────────────────────────────────────

    // A) CONVERSION QUALITY — 35%
    // Only count leads actively in play (exclude untouched NEW + closed NOT_INTERESTED)
    // Rationale: NOT_INTERESTED is correct professional behaviour — not a failure
    const inPlay = total - newLeads - notInterested;
    const conversionQuality = inPlay > 0
      ? Math.min(100, (converted / inPlay) * 100)
      : 0;

    // B) SPEED TO CONTACT — 25%
    // 0h  → 100 pts  |  24h → 67 pts  |  48h → 33 pts  |  72h+ → 0 pts
    const speedScore = Math.max(0, 100 - (avgContactHours / 72) * 100);

    // C) FOLLOW-UP DISCIPLINE — 20%
    // % of follow-up leads that are NOT overdue
    // No follow-ups at all → neutral 50 (absence of data ≠ failure)
    const onTime = followUps - overdueFollowUps;
    const followUpDiscipline = followUps > 0
      ? (onTime / followUps) * 100
      : 50;

    // D) LEAD COVERAGE — 15%
    // % of assigned leads moved out of NEW status
    // Rewards telecallers who touch every lead, not just cherry-pick
    const leadCoverage = total > 0
      ? ((total - newLeads) / total) * 100
      : 0;

    // E) CLOSURE DECISIVENESS — 5%
    // Decisively closing dead leads (NOT_INTERESTED) is professional
    // 30%+ closure rate of worked leads → 100 pts
    const worked = total - newLeads;
    const closureScore = worked > 0
      ? Math.min(100, (notInterested / worked) * 333)
      : 0;

    // ── 4. Weighted score ───────────────────────────────────────────────────
    const rawScore =
      (conversionQuality  * 0.35) +
      (speedScore         * 0.25) +
      (followUpDiscipline * 0.20) +
      (leadCoverage       * 0.15) +
      (closureScore       * 0.05);

    // ── 5. Confidence damping for new telecallers ───────────────────────────
    // < 5 leads = statistically unreliable → blend toward neutral baseline (40)
    // 0 leads → score=40  |  3 leads → 60% real + 40% neutral  |  5+ leads → full score
    const confidence  = Math.min(1, total / 5);
    const NEUTRAL     = 40;
    const dampedScore = rawScore * confidence + NEUTRAL * (1 - confidence);

    const finalScore = Math.round(Math.max(0, Math.min(100, dampedScore)) * 100) / 100;

    // ── 6. Return — backward-compatible + extended ──────────────────────────
    return {
      // Legacy keys — used by dashboard.tsx & performance.tsx (do NOT rename)
      totalLeads:          total,
      converted,
      followUps,
      overdueFollowUps,
      conversionRate:      Math.round(conversionQuality  * 100) / 100,  // ← mapped from conversionQuality
      followUpDiscipline:  Math.round(followUpDiscipline * 100) / 100,
      activityConsistency: Math.round(leadCoverage       * 100) / 100,  // ← mapped from leadCoverage
      overduePenalty:      followUps > 0
                             ? Math.round((overdueFollowUps / followUps) * 100 * 100) / 100
                             : 0,
      score: finalScore,

      // New extended keys — for future Performance page upgrades
      newLeads,
      notInterested,
      inPlay,
      conversionQuality:   Math.round(conversionQuality  * 100) / 100,
      speedScore:          Math.round(speedScore          * 100) / 100,
      avgContactHours:     Math.round(avgContactHours     * 10)  / 10,
      leadCoverage:        Math.round(leadCoverage        * 100) / 100,
      closureScore:        Math.round(closureScore        * 100) / 100,
      confidence:          Math.round(confidence          * 100) / 100,
    };
  }

  async createService(service: InsertService): Promise<Service> {
    const [created] = await db.insert(services).values(service).returning();
    return created;
  }

  async getServicesByAgency(agencyCode: string): Promise<Service[]> {
    return db.select().from(services).where(eq(services.agencyCode, agencyCode)).orderBy(desc(services.createdAt));
  }

  async deleteService(id: string): Promise<void> {
    await db.delete(services).where(eq(services.id, id));
  }

  async deleteServicesByAgency(agencyCode: string): Promise<void> {
    await db.delete(services).where(eq(services.agencyCode, agencyCode));
  }

  async createUpgradeRequest(request: InsertUpgradeRequest): Promise<UpgradeRequest> {
    const [created] = await db.insert(upgradeRequests).values(request).returning();
    return created;
  }

  async getUpgradeRequestsByAgency(agencyCode: string): Promise<UpgradeRequest[]> {
    return db.select().from(upgradeRequests).where(eq(upgradeRequests.agencyCode, agencyCode)).orderBy(desc(upgradeRequests.createdAt));
  }

  async getAllUpgradeRequests(): Promise<UpgradeRequest[]> {
    return db.select().from(upgradeRequests).orderBy(desc(upgradeRequests.createdAt));
  }

  async updateUpgradeRequest(id: string, data: Partial<UpgradeRequest>): Promise<UpgradeRequest | undefined> {
    const [updated] = await db.update(upgradeRequests).set(data).where(eq(upgradeRequests.id, id)).returning();
    return updated;
  }

  async getUpgradeRequest(id: string): Promise<UpgradeRequest | undefined> {
    const [request] = await db.select().from(upgradeRequests).where(eq(upgradeRequests.id, id));
    return request;
  }

  async getNotifications(userId: string, role: string, agencyCode: string | null): Promise<any[]> {
    const notifications: any[] = [];
    const now = new Date();

    if (role === "TELE_CALLER") {
      const [overdueResult] = await db.select({ count: count() }).from(leads).where(
        and(eq(leads.assignedTo, userId), eq(leads.status, "FOLLOW_UP"), lt(leads.followUpDate, now))
      );
      if (overdueResult.count > 0) {
        notifications.push({ type: "OVERDUE_FOLLOWUPS", count: overdueResult.count, message: `You have ${overdueResult.count} overdue follow-up${overdueResult.count > 1 ? "s" : ""}`, severity: "warning" });
      }
      const [newLeadsResult] = await db.select({ count: count() }).from(leads).where(
        and(eq(leads.assignedTo, userId), eq(leads.status, "NEW"))
      );
      if (newLeadsResult.count > 0) {
        notifications.push({ type: "NEW_LEADS", count: newLeadsResult.count, message: `${newLeadsResult.count} new lead${newLeadsResult.count > 1 ? "s" : ""} assigned to you`, severity: "info" });
      }
    }

    if (role === "TEAM_LEADER" && agencyCode) {
      const [unassigned] = await db.select({ count: count() }).from(leads).where(
        and(eq(leads.agencyCode, agencyCode), isNull(leads.assignedTo))
      );
      if (unassigned.count > 0) {
        notifications.push({ type: "UNASSIGNED_LEADS", count: unassigned.count, message: `${unassigned.count} unassigned lead${unassigned.count > 1 ? "s" : ""} need attention`, severity: "warning" });
      }
      const [overdueResult] = await db.select({ count: count() }).from(leads).where(
        and(eq(leads.agencyCode, agencyCode), eq(leads.status, "FOLLOW_UP"), lt(leads.followUpDate, now))
      );
      if (overdueResult.count > 0) {
        notifications.push({ type: "OVERDUE_FOLLOWUPS", count: overdueResult.count, message: `${overdueResult.count} overdue follow-up${overdueResult.count > 1 ? "s" : ""} in your team`, severity: "warning" });
      }
    }

    if (role === "AGENCY_ADMIN" && agencyCode) {
      const pendingUsers = await this.getPendingUsersByAgency(agencyCode);
      if (pendingUsers.length > 0) {
        notifications.push({ type: "PENDING_APPROVALS", count: pendingUsers.length, message: `${pendingUsers.length} user${pendingUsers.length > 1 ? "s" : ""} pending approval`, severity: "info" });
      }
      const [overdueResult] = await db.select({ count: count() }).from(leads).where(
        and(eq(leads.agencyCode, agencyCode), eq(leads.status, "FOLLOW_UP"), lt(leads.followUpDate, now))
      );
      if (overdueResult.count > 0) {
        notifications.push({ type: "OVERDUE_FOLLOWUPS", count: overdueResult.count, message: `${overdueResult.count} overdue follow-up${overdueResult.count > 1 ? "s" : ""} agency-wide`, severity: "warning" });
      }
    }

    if (role === "MASTER_ADMIN") {
      const pendingUsers = await this.getAllPendingUsers();
      if (pendingUsers.length > 0) {
        notifications.push({ type: "PENDING_APPROVALS", count: pendingUsers.length, message: `${pendingUsers.length} user${pendingUsers.length > 1 ? "s" : ""} pending approval`, severity: "info" });
      }
      const allUpgrades = await this.getAllUpgradeRequests();
      const pendingUpgrades = allUpgrades.filter(r => r.status === "PENDING");
      if (pendingUpgrades.length > 0) {
        notifications.push({ type: "PENDING_UPGRADES", count: pendingUpgrades.length, message: `${pendingUpgrades.length} plan upgrade request${pendingUpgrades.length > 1 ? "s" : ""} pending`, severity: "info" });
      }
    }

    return notifications;
  }

  async createRcRecord(record: InsertRcRecord): Promise<RcRecord> {
    const [created] = await db.insert(rcRecords).values(record).returning();
    return created;
  }

  async getRcRecordsByAgency(agencyCode: string): Promise<RcRecord[]> {
    return db.select().from(rcRecords).where(eq(rcRecords.agencyCode, agencyCode)).orderBy(desc(rcRecords.createdAt)).limit(50);
  }

  async getAllRcRecords(): Promise<RcRecord[]> {
    return db.select().from(rcRecords).orderBy(desc(rcRecords.createdAt));
  }

  async deleteRcRecord(id: string): Promise<void> {
    await db.delete(rcRecords).where(eq(rcRecords.id, id));
  }

  async getRcRecordByNumber(agencyCode: string, rcNumber: string): Promise<RcRecord | undefined> {
    const [record] = await db.select().from(rcRecords).where(
      and(eq(rcRecords.agencyCode, agencyCode), eq(rcRecords.rcNumber, rcNumber))
    );
    return record;
  }

  async createPayment(data: InsertPayment): Promise<Payment> {
    const [record] = await db.insert(payments).values(data).returning();
    return record;
  }

  async createPaymentRecord(data: InsertPayment): Promise<Payment> {
    return this.createPayment(data);
  }

  async getPaymentByOrderId(orderId: string): Promise<Payment | undefined> {
    const [record] = await db.select().from(payments).where(eq(payments.razorpayOrderId, orderId));
    return record;
  }

  async getPaymentsByAgency(agencyCode: string): Promise<Payment[]> {
    return db.select().from(payments).where(eq(payments.agencyCode, agencyCode)).orderBy(desc(payments.createdAt));
  }

  async updatePayment(orderId: string, data: Partial<Payment>): Promise<Payment | undefined> {
    const [record] = await db.update(payments).set(data).where(eq(payments.razorpayOrderId, orderId)).returning();
    return record;
  }

  async getAllPayments(): Promise<Payment[]> {
    return db.select().from(payments).orderBy(desc(payments.createdAt));
  }

  async getPaymentsPaginated(page: number = 1, limit: number = 20): Promise<{ payments: Payment[]; total: number }> {
    const offset = (page - 1) * limit;
    const [totalResult] = await db.select({ count: count() }).from(payments);
    const result = await db.select().from(payments).orderBy(desc(payments.createdAt)).limit(limit).offset(offset);
    return { payments: result, total: totalResult.count };
  }

  async createJob(id: string, message: string): Promise<void> {
    await db.insert(processingJobs).values({ id, status: "processing", progress: 5, message });
  }

  async updateJob(id: string, status: string, progress: number, message: string, result?: any, error?: string): Promise<void> {
    await db.update(processingJobs)
      .set({ status, progress, message, result: result || null, error: error || null, updatedAt: new Date() })
      .where(eq(processingJobs.id, id));
  }

  async getJob(id: string): Promise<ProcessingJob | undefined> {
    const [job] = await db.select().from(processingJobs).where(eq(processingJobs.id, id));
    return job;
  }

  async deleteJob(id: string): Promise<void> {
    await db.delete(processingJobs).where(eq(processingJobs.id, id));
  }
  
  async punchIn(data: any): Promise<any> {
    const [created] = await db.insert(attendance).values(data).returning();
    return created;
  }
  async getTodayAttendance(userId: string, date: string): Promise<any> {
    const [record] = await db.select().from(attendance)
      .where(and(eq(attendance.userId, userId), eq(attendance.date, date)));
    return record;
  }
  async getAttendanceByUser(userId: string, agencyCode: string): Promise<any[]> {
    return db.select().from(attendance)
      .where(and(eq(attendance.userId, userId), eq(attendance.agencyCode, agencyCode)))
      .orderBy(desc(attendance.date));
  }
  async getAttendanceByAgency(agencyCode: string, date?: string): Promise<any[]> {
    if (date) {
      return db.select().from(attendance)
        .where(and(eq(attendance.agencyCode, agencyCode), eq(attendance.date, date)))
        .orderBy(desc(attendance.date));
    }
    return db.select().from(attendance)
      .where(eq(attendance.agencyCode, agencyCode))
      .orderBy(desc(attendance.date));
  }
  async updateAttendance(id: string, data: any): Promise<any> {
    const [updated] = await db.update(attendance).set(data).where(eq(attendance.id, id)).returning();
    return updated;
  }
  async createCommission(data: any): Promise<any> {
    const [created] = await db.insert(commissions).values(data).returning();
    return created;
  }
  async getCommissionsByUser(userId: string, agencyCode: string): Promise<any[]> {
    return db.select().from(commissions)
      .where(and(eq(commissions.userId, userId), eq(commissions.agencyCode, agencyCode)))
      .orderBy(desc(commissions.convertedAt));
  }
  async getCommissionsByAgency(agencyCode: string): Promise<any[]> {
    return db.select().from(commissions)
      .where(eq(commissions.agencyCode, agencyCode))
      .orderBy(desc(commissions.convertedAt));
  }
  async updateCommission(id: string, data: any): Promise<any> {
    const [updated] = await db.update(commissions).set(data).where(eq(commissions.id, id)).returning();
    return updated;
  }
  async updateService(id: string, data: any): Promise<any> {
    const [updated] = await db.update(services).set(data).where(eq(services.id, id)).returning();
    return updated;
  }
  async getServiceByName(agencyCode: string, name: string): Promise<any> {
    const [service] = await db.select().from(services)
      .where(and(eq(services.agencyCode, agencyCode), eq(services.name, name)));
    return service;
  }
}

export const storage = new DatabaseStorage();