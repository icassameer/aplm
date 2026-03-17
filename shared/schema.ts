import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, uniqueIndex, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = ["MASTER_ADMIN", "AGENCY_ADMIN", "TEAM_LEADER", "TELE_CALLER"] as const;
export const planEnum = ["BASIC", "PRO", "ENTERPRISE"] as const;
export const leadStatusEnum = ["NEW", "CONTACTED", "FOLLOW_UP", "CONVERTED", "NOT_INTERESTED"] as const;
export const userStatusEnum = ["ACTIVE", "INACTIVE", "PENDING_APPROVAL"] as const;
export const upgradeRequestStatusEnum = ["PENDING", "APPROVED", "DENIED"] as const;
export const subscriptionStatusEnum = ["TRIAL", "ACTIVE", "EXPIRED", "SUSPENDED"] as const;

export const agencies = pgTable("agencies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  agencyCode: text("agency_code").notNull().unique(),
  plan: text("plan").notNull().default("BASIC"),
  isActive: boolean("is_active").notNull().default(true),
  leadLimit: integer("lead_limit").notNull().default(500),
  userLimit: integer("user_limit").notNull().default(10),
  planAssignedAt: timestamp("plan_assigned_at").defaultNow(),
  // ─── Subscription fields ───────────────────────────────────────
  subscriptionStatus: text("subscription_status").notNull().default("TRIAL"),
  subscriptionExpiry: timestamp("subscription_expiry"),
  lastPaymentId: text("last_payment_id"),
  lastPaymentAt: timestamp("last_payment_at"),
  lastPaymentAmount: integer("last_payment_amount"),
  // ──────────────────────────────────────────────────────────────
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("agencies_code_idx").on(table.agencyCode),
  index("agencies_sub_status_idx").on(table.subscriptionStatus),
  index("agencies_sub_expiry_idx").on(table.subscriptionExpiry),
]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  mobile: text("mobile"),
  role: text("role").notNull().default("TELE_CALLER"),
  agencyCode: text("agency_code"),
  isActive: boolean("is_active").notNull().default(true),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("users_agency_idx").on(table.agencyCode),
  index("users_role_idx").on(table.role),
  index("users_status_idx").on(table.status),
]);

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyCode: text("agency_code").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  source: text("source"),
  service: text("service"),
  status: text("status").notNull().default("NEW"),
  assignedTo: text("assigned_to"),
  followUpDate: timestamp("follow_up_date"),
  remarks: text("remarks"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("leads_agency_phone_idx").on(table.agencyCode, table.phone),
  index("leads_agency_idx").on(table.agencyCode),
  index("leads_status_idx").on(table.status),
  index("leads_assigned_idx").on(table.assignedTo),
  index("leads_followup_idx").on(table.followUpDate),
  index("leads_service_idx").on(table.service),
]);

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyCode: text("agency_code").notNull(),
  leadId: text("lead_id"),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  oldStatus: text("old_status"),
  newStatus: text("new_status"),
  remarks: text("remarks"),
  targetUserId: text("target_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("audit_logs_agency_idx").on(table.agencyCode),
  index("audit_logs_lead_idx").on(table.leadId),
  index("audit_logs_user_idx").on(table.userId),
  index("audit_logs_created_idx").on(table.createdAt),
]);

export const meetings = pgTable("meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyCode: text("agency_code").notNull(),
  title: text("title").notNull(),
  audioFileName: text("audio_file_name"),
  transcript: text("transcript"),
  summary: text("summary"),
  targets: text("targets").array(),
  achievements: text("achievements").array(),
  responsiblePersons: text("responsible_persons").array(),
  kpis: text("kpis").array(),
  deadlines: text("deadlines").array(),
  riskPoints: text("risk_points").array(),
  actionItems: text("action_items").array(),
  keyDecisions: text("key_decisions").array(),
  nextSteps: text("next_steps").array(),
  clientMentions: text("client_mentions").array(),
  keyFigures: text("key_figures").array(),
  sentiment: text("sentiment"),
  language: text("language"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("meetings_agency_idx").on(table.agencyCode),
  index("meetings_created_by_idx").on(table.createdBy),
]);

export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyCode: text("agency_code").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("services_agency_idx").on(table.agencyCode),
]);

export const upgradeRequests = pgTable("upgrade_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyCode: text("agency_code").notNull(),
  requestedPlan: text("requested_plan").notNull(),
  currentPlan: text("current_plan").notNull(),
  status: text("status").notNull().default("PENDING"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("upgrade_requests_agency_idx").on(table.agencyCode),
  index("upgrade_requests_status_idx").on(table.status),
]);

export const rcRecords = pgTable("rc_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyCode: text("agency_code").notNull(),
  rcNumber: text("rc_number").notNull(),
  rcData: jsonb("rc_data").notNull(),
  lookedUpBy: text("looked_up_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("rc_records_agency_idx").on(table.agencyCode),
  index("rc_records_rc_idx").on(table.rcNumber),
]);

export { conversations, messages } from "./models/chat";

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyCode: text("agency_code").notNull(),
  razorpayOrderId: text("razorpay_order_id").notNull().unique(),
  razorpayPaymentId: text("razorpay_payment_id"),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("INR"),
  plan: text("plan").notNull(),
  razorpaySignature: text("razorpay_signature"),
  status: text("status").notNull().default("PENDING"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("payments_agency_idx").on(table.agencyCode),
  index("payments_status_idx").on(table.status),
  index("payments_order_idx").on(table.razorpayOrderId),
]);

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

export const insertAgencySchema = createInsertSchema(agencies).omit({ id: true, createdAt: true, planAssignedAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMeetingSchema = createInsertSchema(meetings).omit({ id: true, createdAt: true });
export const insertServiceSchema = createInsertSchema(services).omit({ id: true, createdAt: true });
export const insertUpgradeRequestSchema = createInsertSchema(upgradeRequests).omit({ id: true, createdAt: true });

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const signUpSchema = z.object({
  fullName: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  mobile: z.string().min(10, "Mobile number is required"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type Agency = typeof agencies.$inferSelect;
export type InsertAgency = z.infer<typeof insertAgencySchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type UpgradeRequest = typeof upgradeRequests.$inferSelect;
export type InsertUpgradeRequest = z.infer<typeof insertUpgradeRequestSchema>;
export type Role = typeof roleEnum[number];
export type Plan = typeof planEnum[number];
export type LeadStatus = typeof leadStatusEnum[number];
export type SubscriptionStatus = typeof subscriptionStatusEnum[number];
export type RcRecord = typeof rcRecords.$inferSelect;
export const insertRcRecordSchema = createInsertSchema(rcRecords).omit({ id: true, createdAt: true });
export type InsertRcRecord = z.infer<typeof insertRcRecordSchema>;

export const processingJobs = pgTable("processing_jobs", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("processing"),
  progress: integer("progress").notNull().default(0),
  message: text("message").notNull().default(""),
  result: jsonb("result"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type ProcessingJob = typeof processingJobs.$inferSelect;

export const rcLookups = pgTable("rc_lookups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyCode: text("agency_code").notNull(),
  vehicleNumber: text("vehicle_number").notNull(),
  result: text("result"),
  status: text("status").notNull().default("SUCCESS"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("rc_lookups_agency_idx").on(table.agencyCode),
  index("rc_lookups_created_idx").on(table.createdAt),
]);

export type RcLookup = typeof rcLookups.$inferSelect;
export type InsertRcLookup = typeof rcLookups.$inferInsert;
