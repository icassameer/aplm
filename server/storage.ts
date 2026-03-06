import { eq, and, or, desc, asc, count, sql, ilike, isNull, isNotNull, lt } from "drizzle-orm";
import { db } from "./db";
import {
  agencies, users, leads, auditLogs, meetings, services, upgradeRequests,
  type Agency, type InsertAgency,
  type User, type InsertUser,
  type Lead, type InsertLead,
  type AuditLog, type Meeting, type InsertMeeting,
  type Service, type InsertService,
  type UpgradeRequest, type InsertUpgradeRequest
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
  updateAgency(id: string, data: Partial<Agency>): Promise<Agency | undefined>;
  deleteAgency(id: string): Promise<void>;

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

  async updateAgency(id: string, data: Partial<Agency>): Promise<Agency | undefined> {
    const [updated] = await db.update(agencies).set(data).where(eq(agencies.id, id)).returning();
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
    if (status && status !== "ALL") {
      conditions.push(eq(leads.status, status));
    }
    if (assignmentFilter === "UNASSIGNED") {
      conditions.push(isNull(leads.assignedTo));
    } else if (assignmentFilter === "ASSIGNED") {
      conditions.push(isNotNull(leads.assignedTo));
    }
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(or(ilike(leads.name, term), ilike(leads.phone, term), ilike(leads.email, term))!);
    }
    const where = and(...conditions);

    const [totalResult] = await db.select({ count: count() }).from(leads).where(where);
    const result = await db.select().from(leads).where(where).orderBy(desc(leads.createdAt)).limit(limit).offset(offset);

    return { leads: result, total: totalResult.count };
  }

  async getLeadsByAssignee(assignedTo: string, page: number = 1, limit: number = 20, status?: string, search?: string): Promise<{ leads: Lead[]; total: number }> {
    const offset = (page - 1) * limit;
    const conditions = [eq(leads.assignedTo, assignedTo)];
    if (status && status !== "ALL") {
      conditions.push(eq(leads.status, status));
    }
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(or(ilike(leads.name, term), ilike(leads.phone, term), ilike(leads.email, term))!);
    }
    const where = and(...conditions);
    const [totalResult] = await db.select({ count: count() }).from(leads).where(where);
    const result = await db.select().from(leads).where(where).orderBy(desc(leads.createdAt)).limit(limit).offset(offset);
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

    const result = await db.select({
      status: leads.status,
      count: count(),
    }).from(leads).where(where).groupBy(leads.status);

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

  async getPerformanceStats(agencyCode: string, userId?: string): Promise<any> {
    const conditions = [eq(leads.agencyCode, agencyCode)];
    if (userId) conditions.push(eq(leads.assignedTo, userId));
    const where = and(...conditions);

    const [stats] = await db.select({
      totalLeads: count(),
      converted: sql<number>`count(CASE WHEN ${leads.status} = 'CONVERTED' THEN 1 END)`.mapWith(Number),
      followUps: sql<number>`count(CASE WHEN ${leads.status} = 'FOLLOW_UP' THEN 1 END)`.mapWith(Number),
      overdueFollowUps: sql<number>`count(CASE WHEN ${leads.status} = 'FOLLOW_UP' AND ${leads.followUpDate} < NOW() THEN 1 END)`.mapWith(Number),
    }).from(leads).where(where);

    const total = stats.totalLeads || 1;
    const conversionRate = (stats.converted / total) * 100;
    const followUpDiscipline = stats.followUps > 0 ? ((stats.followUps - stats.overdueFollowUps) / stats.followUps) * 100 : 100;
    const activityConsistency = Math.min(100, (total / 10) * 100);
    const overduePenalty = stats.overdueFollowUps > 0 ? Math.min(100, (stats.overdueFollowUps / total) * 100) : 0;

    const score = (conversionRate * 0.4) + (followUpDiscipline * 0.3) + (activityConsistency * 0.2) - (overduePenalty * 0.1);

    return {
      totalLeads: total,
      converted: stats.converted,
      followUps: stats.followUps,
      overdueFollowUps: stats.overdueFollowUps,
      conversionRate: Math.round(conversionRate * 100) / 100,
      followUpDiscipline: Math.round(followUpDiscipline * 100) / 100,
      activityConsistency: Math.round(activityConsistency * 100) / 100,
      overduePenalty: Math.round(overduePenalty * 100) / 100,
      score: Math.round(Math.max(0, Math.min(100, score)) * 100) / 100,
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
      const [newLeads] = await db.select({ count: count() }).from(leads).where(
        and(eq(leads.assignedTo, userId), eq(leads.status, "NEW"))
      );
      if (newLeads.count > 0) {
        notifications.push({ type: "NEW_LEADS", count: newLeads.count, message: `${newLeads.count} new lead${newLeads.count > 1 ? "s" : ""} assigned to you`, severity: "info" });
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
}

export const storage = new DatabaseStorage();
