import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import archiver from "archiver";
import { z } from "zod";
import type { User } from "@shared/schema";
import { loginSchema, signUpSchema, roleEnum, planEnum, leadStatusEnum } from "@shared/schema";
import { openai, speechToText, transcribeLargeAudio, ensureCompatibleFormat } from "./replit_integrations/audio/client";
import { sendEmail, sendWelcomeEmail, sendProspectEmail, sendPasswordResetEmail, sendPlanUpgradeEmail, sendPaymentLinkEmail,
  sendPaymentSuccessEmail,
} from "./email";
import Anthropic from "@anthropic-ai/sdk";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Validation helpers ────────────────────────────────────────────────────────
function validate<T>(schema: z.ZodSchema<T>, data: unknown): { data: T } | { error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const msg = result.error.errors.map(e => e.message).join(", ");
    return { error: msg };
  }
  return { data: result.data };
}

function sanitizeString(str: string): string {
  return str.trim().replace(/[<>]/g, "");
}

const JWT_SECRET = process.env.SESSION_SECRET!;
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});
const PLAN_PRICES: Record<string, number> = {
  BASIC: 250000,
  PRO: 550000,
  ENTERPRISE: 1200000,
};
const PLAN_LIMITS: Record<string, { leadLimit: number; userLimit: number }> = {
  BASIC: { leadLimit: 500, userLimit: 5 },
  PRO: { leadLimit: 2000, userLimit: 10 },
  ENTERPRISE: { leadLimit: 10000, userLimit: 25 },
};
// Multer with file type validation
const ALLOWED_AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/mp4", "audio/ogg", "audio/webm", "audio/m4a", "video/mp4"];
const ALLOWED_SHEET_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
];

const upload = multer({
  dest: "/tmp/uploads/",
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB — chunked transcription handles large files
  fileFilter: (_req, file, cb) => {
    const allowed = [...ALLOWED_AUDIO_TYPES, ...ALLOWED_SHEET_TYPES];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error(`Invalid file type: ${file.mimetype}`));
  },
});

// AI Proceeding monthly transcription limits per plan
const AI_PROCEEDING_LIMITS: Record<string, number> = {
  BASIC: 0,        // No AI access
  PRO: 15,         // 15 transcriptions per month
  ENTERPRISE: 40,  // 40 transcriptions per month
};

// RC Lookup monthly limits per plan
const RC_LOOKUP_LIMITS: Record<string, number> = {
  BASIC: 0,        // No RC access
  PRO: 50,         // 50 lookups per month
  ENTERPRISE: 200, // 200 lookups per month
};

function generateToken(user: User & { sessionToken?: string | null }): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, agencyCode: user.agencyCode, sessionToken: user.sessionToken },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

interface AuthRequest extends Request {
  user?: { id: string; username: string; role: string; agencyCode: string | null };
}

async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ success: false, message: "Authentication required" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const dbUser = await storage.getUser(decoded.id);
    if (!dbUser) return res.status(401).json({ success: false, message: "User not found" });
    if (dbUser.sessionToken && decoded.sessionToken !== dbUser.sessionToken) {
      return res.status(401).json({ success: false, message: "Session expired. Please login again." });
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

function roleMiddleware(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    next();
  };
}

function checkPlan(...allowedPlans: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user?.agencyCode) return res.status(400).json({ success: false, message: "No agency" });
    const agency = await storage.getAgencyByCode(req.user.agencyCode);
    if (!agency || !allowedPlans.includes(agency.plan)) {
      return res.status(403).json({ success: false, message: `This feature requires ${allowedPlans.join(" or ")} plan` });
    }
    next();
  };
}

function generateAgencyCode(): string {
  return "ICA-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const v = validate(loginSchema, req.body);
      if ("error" in v) return res.status(400).json({ success: false, message: v.error });
      const { username, password } = v.data;

      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ success: false, message: "Invalid credentials" });

      if (user.status === "PENDING_APPROVAL") {
        return res.status(403).json({ success: false, message: "Your account is pending approval. Please contact your administrator." });
      }

      if (!user.isActive || user.status === "INACTIVE") {
        return res.status(403).json({ success: false, message: "Account deactivated" });
      }

      if (user.agencyCode && user.role !== "MASTER_ADMIN") {
        const agency = await storage.getAgencyByCode(user.agencyCode);
        if (agency && !agency.isActive) return res.status(403).json({ success: false, message: "Agency is deactivated" });
      }

      const sessionToken = require("crypto").randomBytes(32).toString("hex");
      await storage.updateSessionToken(user.id, sessionToken);
      const token = generateToken({ ...user, sessionToken });
      const { password: _, ...safeUser } = user;
      res.json({ success: true, data: { token, user: safeUser } });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const v = validate(signUpSchema, req.body);
      if ("error" in v) return res.status(400).json({ success: false, message: v.error });
      const { fullName, email, username, password, mobile } = v.data;

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) return res.status(400).json({ success: false, message: "Username already taken" });

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) return res.status(400).json({ success: false, message: "Email already registered" });

      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.createUser({
        username, password: hashedPassword, fullName, email, mobile,
        role: "TELE_CALLER", agencyCode: null,
        isActive: false, status: "PENDING_APPROVAL"
      });

      res.json({ success: true, message: "Registration successful. Your account is pending approval by an administrator." });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ success: false, message: "User not found" });
      const { password: _, ...safeUser } = user;
      res.json({ success: true, data: safeUser });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.patch("/api/users/change-password", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: "Both passwords required" });
      if (newPassword.length < 6) return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ success: false, message: "User not found" });

      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return res.status(400).json({ success: false, message: "Current password is incorrect" });

      const hashed = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(req.user!.id, { password: hashed });

      await storage.createAuditLog({
        agencyCode: req.user!.agencyCode || "SYSTEM",
        leadId: null, userId: req.user!.id,
        action: "PASSWORD_CHANGE", oldStatus: null, newStatus: null,
        remarks: "User changed own password", targetUserId: req.user!.id,
      });

      res.json({ success: true, message: "Password changed successfully" });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.patch("/api/users/admin-reset-password", authMiddleware, roleMiddleware("MASTER_ADMIN", "AGENCY_ADMIN", "TEAM_LEADER"), async (req: AuthRequest, res: Response) => {
    try {
      const { targetUserId, newPassword } = req.body;
      if (!targetUserId || !newPassword) return res.status(400).json({ success: false, message: "Target user and new password required" });
      if (newPassword.length < 6) return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });

      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) return res.status(404).json({ success: false, message: "User not found" });

      if (targetUser.role === "MASTER_ADMIN") {
        return res.status(403).json({ success: false, message: "Cannot reset Master Admin password" });
      }

      if (req.user!.role === "AGENCY_ADMIN") {
        if (targetUser.agencyCode !== req.user!.agencyCode) {
          return res.status(403).json({ success: false, message: "Cannot modify users from another agency" });
        }
        if (!["TEAM_LEADER", "TELE_CALLER"].includes(targetUser.role)) {
          return res.status(403).json({ success: false, message: "Can only reset passwords for team leaders and telecallers" });
        }
      }

      if (req.user!.role === "TEAM_LEADER") {
        if (targetUser.agencyCode !== req.user!.agencyCode) {
          return res.status(403).json({ success: false, message: "Cannot modify users from another agency" });
        }
        if (targetUser.role !== "TELE_CALLER") {
          return res.status(403).json({ success: false, message: "Can only reset passwords for telecallers" });
        }
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(targetUserId, { password: hashed });

      await storage.createAuditLog({
        agencyCode: req.user!.agencyCode || "SYSTEM",
        leadId: null, userId: req.user!.id,
        action: "ADMIN_PASSWORD_RESET", oldStatus: null, newStatus: null,
        remarks: `Password reset by ${req.user!.role}`, targetUserId,
      });

      res.json({ success: true, message: "Password reset successfully" });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/users/approve/:id", authMiddleware, roleMiddleware("MASTER_ADMIN", "AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) return res.status(404).json({ success: false, message: "User not found" });

      if (req.user!.role === "AGENCY_ADMIN" && targetUser.agencyCode !== req.user!.agencyCode) {
        return res.status(403).json({ success: false, message: "Cannot approve users from another agency" });
      }

      // Prevent re-approval (idempotency guard)
      if (targetUser.status === "ACTIVE") {
      return res.json({ success: true, message: "User already approved" });
      }
      const updateData: any = { status: "ACTIVE", isActive: true };

      if (req.user!.role === "MASTER_ADMIN") {
        const { role, agencyCode } = req.body;
        if (role) updateData.role = role;
        if (agencyCode) updateData.agencyCode = agencyCode;
      }

      await storage.updateUser(req.params.id, updateData);

      await storage.createAuditLog({
        agencyCode: targetUser.agencyCode || req.user!.agencyCode || "SYSTEM",
        leadId: null, userId: req.user!.id,
        action: "USER_APPROVED", oldStatus: "PENDING_APPROVAL", newStatus: "ACTIVE",
        remarks: `User approved by ${req.user!.role}${updateData.role ? ` as ${updateData.role}` : ''}`, targetUserId: req.params.id,
      });

      res.json({ success: true, message: "User approved" });

      res.json({ success: true, message: "User approved" });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/users/reject/:id", authMiddleware, roleMiddleware("MASTER_ADMIN", "AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) return res.status(404).json({ success: false, message: "User not found" });

      if (req.user!.role === "AGENCY_ADMIN" && targetUser.agencyCode !== req.user!.agencyCode) {
        return res.status(403).json({ success: false, message: "Cannot reject users from another agency" });
      }

      await storage.updateUser(req.params.id, { status: "INACTIVE", isActive: false });
      res.json({ success: true, message: "User rejected" });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/agencies", authMiddleware, roleMiddleware("MASTER_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { name, plan, leadLimit, userLimit } = req.body;
      const agencyCode = generateAgencyCode();
      const agency = await storage.createAgency({
        name, agencyCode, plan: plan || "BASIC",
        isActive: true, leadLimit: leadLimit || 500, userLimit: userLimit || 10
      });
      res.json({ success: true, data: agency });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/agencies", authMiddleware, roleMiddleware("MASTER_ADMIN"), async (req: AuthRequest, res: Response) => {
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
  });

  app.patch("/api/agencies/:id", authMiddleware, roleMiddleware("MASTER_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const updated = await storage.updateAgency(req.params.id, req.body);
      if (!updated) return res.status(404).json({ success: false, message: "Agency not found" });
      res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.delete("/api/agencies/:id", authMiddleware, roleMiddleware("MASTER_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const agency = await storage.getAgency(req.params.id);
      if (!agency) return res.status(404).json({ success: false, message: "Agency not found" });
      await storage.deleteAgency(req.params.id);
      res.json({ success: true, message: "Agency and all associated data deleted" });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/users", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { username, password, fullName, email, role, mobile } = req.body;
      const currentUser = req.user!;

      if (currentUser.role === "MASTER_ADMIN" && role !== "AGENCY_ADMIN") {
        return res.status(400).json({ success: false, message: "Master admin can only create agency admins" });
      }
      if (currentUser.role === "AGENCY_ADMIN" && !["TEAM_LEADER", "TELE_CALLER"].includes(role)) {
        return res.status(400).json({ success: false, message: "Agency admin can only create team leaders and telecallers" });
      }

      const agencyCode = currentUser.role === "MASTER_ADMIN" ? req.body.agencyCode : currentUser.agencyCode;

      if (agencyCode) {
        const agency = await storage.getAgencyByCode(agencyCode);
        if (agency) {
          const userCount = await storage.countUsersByAgency(agencyCode);
          if (userCount >= agency.userLimit) {
            return res.status(400).json({ success: false, message: "User limit reached for this agency" });
          }
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const teamLeaderId = role === "TELE_CALLER" ? (req.body.teamLeaderId || null) : null;
      const user = await storage.createUser({
        username, password: hashedPassword, fullName, email, mobile: mobile || null,
        role, agencyCode, isActive: true, status: "ACTIVE", teamLeaderId,
      });
      const { password: _, ...safeUser } = user;

      // Send welcome email if email provided and agency exists
      if (email && agencyCode) {
        const agency = await storage.getAgencyByCode(agencyCode);
        if (agency) {
          sendWelcomeEmail(email, fullName, username, password, role, agency.plan, agency.name).catch(err =>
            console.error("Welcome email failed:", err.message)
          );
        }
      }

      res.json({ success: true, data: safeUser });
    } catch (error: any) {
      if (error.message?.includes("unique")) {
        return res.status(400).json({ success: false, message: "Username already exists" });
      }
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/users", authMiddleware, roleMiddleware("MASTER_ADMIN", "AGENCY_ADMIN", "TEAM_LEADER"), async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role === "MASTER_ADMIN") {
        const agencyFilter = req.query.agency as string | undefined;
        const all = await storage.getUsersByAgencyFilter(agencyFilter || undefined);
        const safeUsers = all.map(({ password, ...rest }) => rest);
        return res.json({ success: true, data: safeUsers });
      }
      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency code" });
      if (req.user!.role === "TEAM_LEADER") {
        const userList = await storage.getTelecallersByTeamLeader(req.user!.id);
        const safeUsers = userList.map(({ password, ...rest }) => rest);
        return res.json({ success: true, data: safeUsers });
      }
      const userList = await storage.getUsersByAgency(agencyCode);
      const safeUsers = userList.map(({ password, ...rest }) => rest);
      res.json({ success: true, data: safeUsers });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/users/pending", authMiddleware, roleMiddleware("MASTER_ADMIN", "AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role === "MASTER_ADMIN") {
        const pending = await storage.getAllPendingUsers();
        const safeUsers = pending.map(({ password, ...rest }) => rest);
        return res.json({ success: true, data: safeUsers });
      }
      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency code" });
      const pending = await storage.getPendingUsersByAgency(agencyCode);
      const safeUsers = pending.map(({ password, ...rest }) => rest);
      res.json({ success: true, data: safeUsers });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.patch("/api/users/:id", authMiddleware, roleMiddleware("MASTER_ADMIN", "AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) return res.status(404).json({ success: false, message: "User not found" });

      if (req.user!.role === "AGENCY_ADMIN" && targetUser.agencyCode !== req.user!.agencyCode) {
        return res.status(403).json({ success: false, message: "Cannot modify users from another agency" });
      }

      const data = { ...req.body };
      if (req.user!.role !== "MASTER_ADMIN") {
        delete data.role;
        delete data.agencyCode;
      }
      if (data.password) {
        data.password = await bcrypt.hash(data.password, 10);
      }
      const updated = await storage.updateUser(req.params.id, data);
      if (!updated) return res.status(404).json({ success: false, message: "User not found" });
      const { password: _, ...safeUser } = updated;
      res.json({ success: true, data: safeUser });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.delete("/api/users/:id", authMiddleware, roleMiddleware("MASTER_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) return res.status(404).json({ success: false, message: "User not found" });
      if (targetUser.role === "MASTER_ADMIN") {
        return res.status(403).json({ success: false, message: "Cannot delete Master Admin" });
      }
      await storage.deleteUser(req.params.id);
      res.json({ success: true, message: "User deleted successfully" });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/leads", authMiddleware, roleMiddleware("TEAM_LEADER", "AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });

      const agency = await storage.getAgencyByCode(agencyCode);
      if (agency) {
        const leadCount = await storage.countLeadsByAgency(agencyCode);
        if (leadCount >= agency.leadLimit) {
          return res.status(400).json({ success: false, message: "Lead limit reached for this agency" });
        }
      }

      const lead = await storage.createLead({
        ...req.body,
        agencyCode,
        createdBy: req.user!.id,
        status: "NEW"
      });
      res.json({ success: true, data: lead });
    } catch (error: any) {
      if (error.message?.includes("unique") || error.message?.includes("duplicate")) {
        return res.status(400).json({ success: false, message: "A lead with this phone number already exists" });
      }
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/leads", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;
      const search = req.query.search as string;

      if (req.user!.role === "TELE_CALLER") {
        const result = await storage.getLeadsByAssignee(req.user!.id, page, limit, status, search);
        return res.json({ success: true, data: result });
      }

      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });
      const assignment = req.query.assignment as string;
      const assignedToFilter = req.query.assignedTo as string | undefined;
      const teamLeaderIdFilter = req.user!.role === "TEAM_LEADER" ? req.user!.id : undefined;
      const result = await storage.getLeadsByAgency(agencyCode, page, limit, status, assignment, search, assignedToFilter, teamLeaderIdFilter);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.patch("/api/leads/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

      if (req.user!.agencyCode && lead.agencyCode !== req.user!.agencyCode) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }

      if (req.user!.role === "TELE_CALLER" && lead.assignedTo !== req.user!.id) {
        return res.status(403).json({ success: false, message: "Not assigned to you" });
      }

      if (req.body.assignedTo !== undefined && req.user!.role !== "TEAM_LEADER") {
        return res.status(403).json({ success: false, message: "Only Team Leaders can assign leads" });
      }
      if (req.body.assignedTo !== undefined && req.user!.role === "TEAM_LEADER") {
        req.body.teamLeaderId = req.user!.id;
      }

      if (req.body.status === "FOLLOW_UP" && !req.body.followUpDate) {
        return res.status(400).json({ success: false, message: "Follow-up date is required" });
      }

      const updateData = { ...req.body };
      if (updateData.followUpDate) {
        updateData.followUpDate = new Date(updateData.followUpDate);
      }

      const oldStatus = lead.status;
      // Set firstContactedAt once when lead moves out of NEW for the first time
      if (oldStatus === "NEW" && updateData.status && updateData.status !== "NEW" && !lead.firstContactedAt) {
        updateData.firstContactedAt = new Date();
      }
      const updated = await storage.updateLead(req.params.id, updateData);
      if (req.body.status === "CONVERTED" && oldStatus !== "CONVERTED" && lead.assignedTo) {
        try {
          const agency = await storage.getAgencyByCode(lead.agencyCode);
          let commissionAmount = agency?.commissionPerLead || 0;
          if (lead.service) {
            const svc = await storage.getServiceByName(lead.agencyCode, lead.service);
            if (svc && svc.commissionAmount && svc.commissionAmount > 0) commissionAmount = svc.commissionAmount;
          }
          if (commissionAmount > 0) await storage.createCommission({ agencyCode: lead.agencyCode, userId: lead.assignedTo, leadId: lead.id, amount: commissionAmount, paidStatus: "PENDING", convertedAt: new Date() });
        } catch (e) { console.error("[commission]", e); }
      }

      if (req.body.status && req.body.status !== oldStatus) {
        await storage.createAuditLog({
          agencyCode: lead.agencyCode,
          leadId: lead.id,
          userId: req.user!.id,
          action: "STATUS_CHANGE",
          oldStatus,
          newStatus: req.body.status,
          remarks: req.body.remarks || null,
          targetUserId: null,
        });
      }

      if (req.body.assignedTo) {
        await storage.createAuditLog({
          agencyCode: lead.agencyCode,
          leadId: lead.id,
          userId: req.user!.id,
          action: "LEAD_ASSIGNED",
          oldStatus: null,
          newStatus: null,
          remarks: `Lead assigned${req.body.service ? ` for service: ${req.body.service}` : ''}`,
          targetUserId: req.body.assignedTo,
        });
      }

      res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.delete("/api/leads/:id", authMiddleware, roleMiddleware("TEAM_LEADER"), async (req: AuthRequest, res: Response) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
      if (lead.agencyCode !== req.user!.agencyCode) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
      await storage.deleteLead(req.params.id);
      res.json({ success: true, message: "Lead deleted" });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/leads/bulk-assign", authMiddleware, roleMiddleware("TEAM_LEADER"), async (req: AuthRequest, res: Response) => {
    try {
      const { leadIds, assignedTo, service } = req.body;
      if (!Array.isArray(leadIds) || leadIds.length === 0 || !assignedTo) {
        return res.status(400).json({ success: false, message: "Lead IDs and assignee required" });
      }

      let assigned = 0;
      for (const leadId of leadIds) {
        const lead = await storage.getLead(leadId);
        if (lead && lead.agencyCode === req.user!.agencyCode) {
          await storage.updateLead(leadId, { assignedTo, service: service || lead.service, teamLeaderId: req.user!.id });
          await storage.createAuditLog({
            agencyCode: lead.agencyCode,
            leadId: lead.id,
            userId: req.user!.id,
            action: "LEAD_ASSIGNED",
            oldStatus: null, newStatus: null,
            remarks: `Bulk assigned${service ? ` for service: ${service}` : ''}`,
            targetUserId: assignedTo,
          });
          assigned++;
        }
      }

      res.json({ success: true, data: { assigned, total: leadIds.length } });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/leads/bulk", authMiddleware, roleMiddleware("TEAM_LEADER", "AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });

      const leadsData = req.body.leads as any[];
      if (!Array.isArray(leadsData) || leadsData.length === 0) {
        return res.status(400).json({ success: false, message: "No leads provided" });
      }

      const agency = await storage.getAgencyByCode(agencyCode);
      if (agency) {
        const leadCount = await storage.countLeadsByAgency(agencyCode);
        if (leadCount + leadsData.length > agency.leadLimit) {
          return res.status(400).json({ success: false, message: "Would exceed lead limit" });
        }
      }

      const results = { total: leadsData.length, created: 0, duplicates: 0, invalid: 0, errors: [] as string[] };
      for (const leadData of leadsData) {
        if (!leadData.name || !leadData.phone) {
          results.invalid++;
          results.errors.push(`Missing name or phone`);
          continue;
        }
        try {
          await storage.createLead({
            name: leadData.name,
            phone: String(leadData.phone).trim(),
            email: leadData.email || null,
            source: leadData.source || "Bulk Upload",
            service: leadData.service || null,
            agencyCode,
            createdBy: req.user!.id,
            status: "NEW",
            assignedTo: null,
            followUpDate: null,
            remarks: null,
          });
          results.created++;
        } catch (err: any) {
          if (err.message?.includes("unique") || err.message?.includes("duplicate")) {
            results.duplicates++;
          } else {
            results.invalid++;
            console.error(`Bulk lead import error for ${leadData.phone}:`, err);
            results.errors.push(`${leadData.phone}: Import failed`);
          }
        }
      }

      res.json({ success: true, data: results });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/leads/upload", authMiddleware, roleMiddleware("TEAM_LEADER", "AGENCY_ADMIN"), upload.single("file"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });
      if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

      const fileBuffer = fs.readFileSync(req.file.path);
      const workbook = XLSX.read(fileBuffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];

      fs.unlinkSync(req.file.path);

      if (data.length === 0) return res.status(400).json({ success: false, message: "File is empty" });

      const agency = await storage.getAgencyByCode(agencyCode);
      if (agency) {
        const leadCount = await storage.countLeadsByAgency(agencyCode);
        if (leadCount + data.length > agency.leadLimit) {
          return res.status(400).json({ success: false, message: "Would exceed lead limit" });
        }
      }

      const results = { total: data.length, created: 0, duplicates: 0, invalid: 0, errors: [] as string[] };
      for (const row of data) {
        const name = row.name || row.Name || row.NAME;
        const phone = row.phone || row.Phone || row.PHONE || row.mobile || row.Mobile;
        if (!name || !phone) { results.invalid++; continue; }
        try {
          await storage.createLead({
            name: String(name).trim(),
            phone: String(phone).trim(),
            email: (row.email || row.Email || null),
            source: (row.source || row.Source || "Bulk Upload"),
            service: (row.service || row.Service || null),
            agencyCode,
            createdBy: req.user!.id,
            status: "NEW",
            assignedTo: null,
            followUpDate: null,
            remarks: null,
          });
          results.created++;
        } catch (err: any) {
          if (err.message?.includes("unique") || err.message?.includes("duplicate")) {
            results.duplicates++;
          } else {
            results.invalid++;
          }
        }
      }

      res.json({ success: true, data: results });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/leads/template", authMiddleware, roleMiddleware("TEAM_LEADER", "AGENCY_ADMIN"), (req: Request, res: Response) => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["name", "phone", "email", "source", "service"],
      ["John Doe", "9876543210", "john@example.com", "Website", "Insurance"],
      ["Jane Smith", "9876543211", "jane@example.com", "Referral", "Loan"],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=lead_upload_template.xlsx");
    res.send(buf);
  });

  app.get("/api/services", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });
      const serviceList = await storage.getServicesByAgency(agencyCode);
      res.json({ success: true, data: serviceList });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/services", authMiddleware, roleMiddleware("AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });
      const { name } = req.body;
      if (!name) return res.status(400).json({ success: false, message: "Service name required" });
      const commissionAmt = Number(req.body.commissionAmount) || 0;
      const service = await storage.createService({ agencyCode, name, commissionAmount: commissionAmt });
      res.json({ success: true, data: service });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.delete("/api/services/:id", authMiddleware, roleMiddleware("AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      await storage.deleteService(req.params.id);
      res.json({ success: true, message: "Service deleted" });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // v9.4 — Update service commission amount
  app.patch("/api/services/:id", authMiddleware, roleMiddleware("AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { commissionAmount } = req.body;
      if (commissionAmount === undefined) return res.status(400).json({ success: false, message: "commissionAmount required" });
      const updated = await storage.updateService(req.params.id, { commissionAmount: Number(commissionAmount) });
      res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // v9.4 — Set office location (Agency Admin)
  app.patch("/api/agency/office-location", authMiddleware, roleMiddleware("AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });
      const { officeLatitude, officeLongitude, officeRadiusMeters, commissionPerLead } = req.body;
      const updateData: any = {};
      if (officeLatitude !== undefined) updateData.officeLatitude = officeLatitude;
      if (officeLongitude !== undefined) updateData.officeLongitude = officeLongitude;
      if (officeRadiusMeters !== undefined) updateData.officeRadiusMeters = Number(officeRadiusMeters);
      if (commissionPerLead !== undefined) updateData.commissionPerLead = Number(commissionPerLead);
      const updated = await storage.updateAgencyByCode(agencyCode, updateData);
      res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // v9.4 — Attendance: Punch In
  app.post("/api/attendance/punch-in", authMiddleware, roleMiddleware("TELE_CALLER", "TEAM_LEADER", "AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyCode = req.user!.agencyCode;
      const userId = req.user!.id;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });
      const { latitude, longitude } = req.body;
      if (!latitude || !longitude) return res.status(400).json({ success: false, message: "GPS coordinates required" });
      const today = new Date().toISOString().split("T")[0];
      const existing = await storage.getTodayAttendance(userId, today);
      if (existing) return res.status(400).json({ success: false, message: "Already punched in today" });
      // Check office radius
      const agency = await storage.getAgencyByCode(agencyCode);
      if (agency?.officeLatitude && agency?.officeLongitude) {
        const R = 6371000;
        const lat1 = parseFloat(agency.officeLatitude) * Math.PI / 180;
        const lat2 = parseFloat(latitude) * Math.PI / 180;
        const dLat = lat2 - lat1;
        const dLng = (parseFloat(longitude) - parseFloat(agency.officeLongitude)) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2) * Math.sin(dLng/2);
        const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const allowedRadius = agency.officeRadiusMeters || 100;
        if (distance > allowedRadius) {
          return res.status(400).json({ success: false, message: `You are ${Math.round(distance)}m away from office. Must be within ${allowedRadius}m to punch in.` });
        }
      }
      const record = await storage.punchIn({
        agencyCode,
        userId,
        date: today,
        punchInAt: new Date(),
        punchInLat: String(latitude),
        punchInLng: String(longitude),
        status: "PRESENT",
      });
      res.json({ success: true, data: record });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // v9.4 — Attendance: Punch Out
  app.post("/api/attendance/punch-out", authMiddleware, roleMiddleware("TELE_CALLER", "TEAM_LEADER", "AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { latitude, longitude } = req.body;
      const today = new Date().toISOString().split("T")[0];
      const existing = await storage.getTodayAttendance(userId, today);
      if (!existing) return res.status(400).json({ success: false, message: "No punch-in found for today" });
      if (existing.punchOutAt) return res.status(400).json({ success: false, message: "Already punched out today" });
      const updated = await storage.updateAttendance(existing.id, {
        punchOutAt: new Date(),
        punchOutLat: latitude ? String(latitude) : null,
        punchOutLng: longitude ? String(longitude) : null,
      });
      res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // v9.4 — Attendance: Get today status
  app.get("/api/attendance/today", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const today = new Date().toISOString().split("T")[0];
      const record = await storage.getTodayAttendance(userId, today);
      res.json({ success: true, data: record || null });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // v9.4 — Attendance: Get attendance list (role-based)
  app.get("/api/attendance", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { role, id: userId, agencyCode } = req.user!;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });
      const { date } = req.query;
      let records;
      if (role === "TELE_CALLER") {
        records = await storage.getAttendanceByUser(userId, agencyCode);
      } else {
        records = await storage.getAttendanceByAgency(agencyCode, date as string);
      }
      // Attach user names
      const agencyUsers = await storage.getUsersByAgency(agencyCode);
      const userMap = Object.fromEntries(agencyUsers.map(u => [u.id, u.fullName]));
      const enriched = records.map(r => ({ ...r, userName: userMap[r.userId] || "Unknown" }));
      res.json({ success: true, data: enriched });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // v9.4 — Commissions: Get commissions (role-based)
  app.get("/api/commissions", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { role, id: userId, agencyCode } = req.user!;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });
      let records;
      if (role === "TELE_CALLER") {
        records = await storage.getCommissionsByUser(userId, agencyCode);
      } else {
        records = await storage.getCommissionsByAgency(agencyCode);
      }
      // Attach user names
      const agencyUsers = await storage.getUsersByAgency(agencyCode);
      const userMap = Object.fromEntries(agencyUsers.map(u => [u.id, u.fullName]));
      const enriched = records.map(r => ({ ...r, userName: userMap[r.userId] || "Unknown" }));
      res.json({ success: true, data: enriched });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // v9.4 — Commissions: Mark as paid (Agency Admin only)
  app.patch("/api/commissions/:id/paid", authMiddleware, roleMiddleware("AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const updated = await storage.updateCommission(req.params.id, { paidStatus: "PAID", paidAt: new Date() });
      res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // v9.4 — Commissions: Get agency commission settings
  app.get("/api/agency/commission-settings", authMiddleware, roleMiddleware("AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });
      const agency = await storage.getAgencyByCode(agencyCode);
      res.json({ success: true, data: {
        commissionPerLead: agency?.commissionPerLead || 0,
        officeLatitude: agency?.officeLatitude || null,
        officeLongitude: agency?.officeLongitude || null,
        officeRadiusMeters: agency?.officeRadiusMeters || 100,
      }});
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/upgrade-requests", authMiddleware, roleMiddleware("AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });

      const agency = await storage.getAgencyByCode(agencyCode);
      if (!agency) return res.status(404).json({ success: false, message: "Agency not found" });

      const { requestedPlan, remarks } = req.body;
      if (!requestedPlan) return res.status(400).json({ success: false, message: "Requested plan required" });

      const request = await storage.createUpgradeRequest({
        agencyCode,
        requestedPlan,
        currentPlan: agency.plan,
        status: "PENDING",
        remarks: remarks || null,
      });

      res.json({ success: true, data: request });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/upgrade-requests", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role === "MASTER_ADMIN") {
        const requests = await storage.getAllUpgradeRequests();
        return res.json({ success: true, data: requests });
      }
      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });
      const requests = await storage.getUpgradeRequestsByAgency(agencyCode);
      res.json({ success: true, data: requests });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.patch("/api/upgrade-requests/:id", authMiddleware, roleMiddleware("MASTER_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { status } = req.body;
      if (!["APPROVED", "DENIED"].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status" });
      }

      const request = await storage.getUpgradeRequest(req.params.id);
      if (!request) return res.status(404).json({ success: false, message: "Request not found" });

      await storage.updateUpgradeRequest(req.params.id, { status });

      if (status === "APPROVED") {
        const agency = await storage.getAgencyByCode(request.agencyCode);
        if (agency) {
          const planLimits: Record<string, { leadLimit: number; userLimit: number }> = {
            BASIC: { leadLimit: 500, userLimit: 10 },
            PRO: { leadLimit: 2000, userLimit: 50 },
            ENTERPRISE: { leadLimit: 10000, userLimit: 200 },
          };
          const limits = planLimits[request.requestedPlan] || planLimits.BASIC;
        await storage.updateAgency(agency.id, {
            plan: request.requestedPlan,
            leadLimit: limits.leadLimit,
            userLimit: limits.userLimit,
            planAssignedAt: new Date(),
          });
          // Send plan upgrade email to agency admin
          const agencyAdmin = await storage.getUsersByAgency(agency.agencyCode);
          const admin = agencyAdmin.find(u => u.role === "AGENCY_ADMIN");
          if (admin?.email) {
            sendPlanUpgradeEmail(admin.email, admin.fullName, agency.plan, request.requestedPlan).catch(err =>
              console.error("Plan upgrade email failed:", err.message)
            );
          }
        }
      }

      res.json({ success: true, message: `Request ${status.toLowerCase()}` });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/reports/leads", authMiddleware, roleMiddleware("AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });

      const { leads: allLeads } = await storage.getLeadsByAgency(agencyCode, 1, 10000);
      const allUsers = await storage.getUsersByAgency(agencyCode);
      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const wb = XLSX.utils.book_new();
      const data = allLeads.map(l => {
        const telecaller = l.assignedTo ? userMap.get(l.assignedTo) : null;
        const creator = l.createdBy ? userMap.get(l.createdBy) : null;
        const teamLeader = creator?.role === "TEAM_LEADER" ? creator : null;
        return {
          Name: l.name, Phone: l.phone, Email: l.email || "",
          Source: l.source || "", Service: l.service || "", Status: l.status,
          "Assigned Telecaller": telecaller ? telecaller.fullName : "Unassigned",
          "Team Leader": teamLeader ? teamLeader.fullName : "—",
          "Follow-Up Date": l.followUpDate ? new Date(l.followUpDate).toLocaleDateString() : "",
          Remarks: l.remarks || "",
            "Created At": l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "",
        };
      });
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Leads");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=lead_report.xlsx");
      res.send(buf);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/reports/leads/team-leader", authMiddleware, roleMiddleware("TEAM_LEADER"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });

      const telecallerIdFilter = req.query.telecallerId as string | undefined;
      const { leads: allLeads } = await storage.getLeadsByAgency(agencyCode, 1, 10000);
      const allUsers = await storage.getUsersByAgency(agencyCode);
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      const filtered = telecallerIdFilter && telecallerIdFilter !== "ALL"
        ? allLeads.filter(l => l.assignedTo === telecallerIdFilter)
        : allLeads;

      const telecallerName = telecallerIdFilter && telecallerIdFilter !== "ALL"
        ? (userMap.get(telecallerIdFilter)?.fullName || "Telecaller")
        : "All";

      const wb = XLSX.utils.book_new();
      const data = filtered.map(l => {
        const telecaller = l.assignedTo ? userMap.get(l.assignedTo) : null;
        const creator = l.createdBy ? userMap.get(l.createdBy) : null;
        const teamLeader = creator?.role === "TEAM_LEADER" ? creator : null;
        return {
          Name: l.name,
          Phone: l.phone,
          Email: l.email || "",
          Source: l.source || "",
          Service: l.service || "",
          Status: l.status,
          "Assigned Telecaller": telecaller ? telecaller.fullName : "Unassigned",
          "Team Leader": teamLeader ? teamLeader.fullName : "—",
          "Follow-Up Date": l.followUpDate ? new Date(l.followUpDate).toLocaleDateString() : "",
          Remarks: l.remarks || "",
          "Created At": l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "",
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Leads");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      const filename = `leads_${telecallerName.replace(/\s+/g, "_")}.xlsx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
      res.send(buf);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/reports/performance", authMiddleware, roleMiddleware("AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });

      const teamUsers = await storage.getUsersByAgency(agencyCode);
      const telecallers = teamUsers.filter(u => u.role === "TELE_CALLER");
      const performances = await Promise.all(
        telecallers.map(async (tc) => {
          const stats = await storage.getPerformanceStats(agencyCode, tc.id);
          return { Name: tc.fullName, Username: tc.username, ...stats };
        })
      );

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(performances.map(p => ({
        Name: p.Name, Username: p.Username,
        "Total Leads": p.totalLeads, Converted: p.converted,
        "Follow Ups": p.followUps, "Overdue": p.overdueFollowUps,
        "Conversion Rate %": p.conversionRate, "Score": p.score,
      })));
      XLSX.utils.book_append_sheet(wb, ws, "Performance");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=performance_report.xlsx");
      res.send(buf);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/reports/conversion", authMiddleware, roleMiddleware("AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });

      const stats = await storage.getLeadStats(agencyCode);
      const total = Object.values(stats).reduce((a, b) => a + b, 0);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet([
        { Metric: "Total Leads", Value: total },
        { Metric: "New", Value: stats.NEW },
        { Metric: "Contacted", Value: stats.CONTACTED },
        { Metric: "Follow Up", Value: stats.FOLLOW_UP },
        { Metric: "Converted", Value: stats.CONVERTED },
        { Metric: "Not Interested", Value: stats.NOT_INTERESTED },
        { Metric: "Conversion Rate", Value: total > 0 ? `${((stats.CONVERTED / total) * 100).toFixed(1)}%` : "0%" },
      ]);
      XLSX.utils.book_append_sheet(wb, ws, "Conversion");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=conversion_report.xlsx");
      res.send(buf);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/stats/leads", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const agencyCode = req.user!.agencyCode;
      if (req.user!.role === "MASTER_ADMIN") {
        const allAgencies = await storage.getAllAgencies();
        const stats = await Promise.all(
          allAgencies.map(async (a) => ({
            agency: a.name, agencyCode: a.agencyCode,
            stats: await storage.getLeadStats(a.agencyCode)
          }))
        );
        return res.json({ success: true, data: stats });
      }
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });
      const assignedTo = req.user!.role === "TELE_CALLER" ? req.user!.id : undefined;
      const stats = await storage.getLeadStats(agencyCode, assignedTo);
      res.json({ success: true, data: stats });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/performance/telecaller", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });

      if (req.user!.role === "TELE_CALLER") {
        const stats = await storage.getPerformanceStats(agencyCode, req.user!.id);
        return res.json({ success: true, data: [{ userId: req.user!.id, ...stats }] });
      }

      const teamUsers = await storage.getUsersByAgency(agencyCode);
      const telecallers = teamUsers.filter(u => u.role === "TELE_CALLER");
      const performances = await Promise.all(
        telecallers.map(async (tc) => {
          const stats = await storage.getPerformanceStats(agencyCode, tc.id);
          return { userId: tc.id, fullName: tc.fullName, username: tc.username, ...stats };
        })
      );
      performances.sort((a, b) => b.score - a.score);
      res.json({ success: true, data: performances });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/audit-logs", authMiddleware, roleMiddleware("AGENCY_ADMIN", "TEAM_LEADER"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const leadId = req.query.leadId as string;
      const result = await storage.getAuditLogs(agencyCode, page, limit, leadId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/notifications", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const notifications = await storage.getNotifications(req.user!.id, req.user!.role, req.user!.agencyCode);
      res.json({ success: true, data: notifications });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // AI Proceeding usage endpoint — returns current month usage + plan limit
  app.get("/api/meetings/usage", authMiddleware, roleMiddleware("AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });

      const agency = await storage.getAgencyByCode(agencyCode);
      if (!agency) return res.status(404).json({ success: false, message: "Agency not found" });

      const plan = agency.plan as string;
      const limit = AI_PROCEEDING_LIMITS[plan] ?? 0;
      const usedThisMonth = await storage.countMeetingsThisMonth(agencyCode);

      res.json({
        success: true,
        data: {
          plan,
          limit: limit === Infinity ? null : limit,   // null = unlimited
          used: usedThisMonth,
          remaining: limit === Infinity ? null : Math.max(0, limit - usedThisMonth),
          hasAccess: plan === "PRO" || plan === "ENTERPRISE",
          limitReached: limit !== Infinity && usedThisMonth >= limit,
        }
      });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // GET /api/meetings/job/:jobId — check background job status (DB-backed, works across PM2 cluster)
  app.get("/api/meetings/job/:jobId", authMiddleware, async (req: AuthRequest, res: Response) => {
    const job = await storage.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });
    res.json({ success: true, status: job.status, progress: job.progress, message: job.message, result: job.result, error: job.error });
  });

  app.post("/api/meetings", authMiddleware, roleMiddleware("AGENCY_ADMIN"), upload.single("audio"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });

      const agency = await storage.getAgencyByCode(agencyCode);
      if (!agency || (agency.plan !== "PRO" && agency.plan !== "ENTERPRISE")) {
        return res.status(403).json({ success: false, message: "AI Proceeding requires PRO or ENTERPRISE plan" });
      }

      // Enforce monthly transcription limit for PRO plan
      const plan = agency.plan as string;
      const limit = AI_PROCEEDING_LIMITS[plan] ?? 0;
      if (limit !== Infinity) {
        const usedThisMonth = await storage.countMeetingsThisMonth(agencyCode);
        if (usedThisMonth >= limit) {
          return res.status(429).json({
            success: false,
            limitReached: true,
            message: `Monthly AI Proceeding limit reached (${usedThisMonth}/${limit}). Upgrade to ENTERPRISE for unlimited access.`,
            used: usedThisMonth,
            limit,
          });
        }
      }

      const title = req.body.title;
      const audioLanguage = req.body.language || undefined; // e.g. "hi", "mr", "en"
      let transcript = req.body.transcript || "";
      const audioFileName = req.file ? req.file.originalname : null;

      // ── Background Processing for Audio Files ────────────────────────────────
      if (req.file) {
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const filePath = req.file.path;
        const originalName = req.file.originalname;
        const userId = req.user!.id;

        // Start background processing — stored in DB so all PM2 instances can access it
        await storage.createJob(jobId, "🎵 Audio received, starting transcription...");

        // Return job ID immediately so frontend can poll
        res.json({ success: true, jobId, message: "Processing started in background" });

        // Process in background
        (async () => {
          try {
            // Step 1: Transcription
            await storage.updateJob(jobId, "processing", 15, "🎙️ Transcribing audio... (this may take 1-3 minutes for large files)");
            const audioBuffer = fs.readFileSync(filePath);
            await storage.updateJob(jobId, "processing", 20, "🎙️ Transcribing audio... Large files split into chunks automatically");
            transcript = await transcribeLargeAudio(audioBuffer, audioLanguage);
            try { fs.unlinkSync(filePath); } catch {}

            // Step 2 + 3: Speaker diarization + AI Insights in ONE GPT-4o call
            await storage.updateJob(jobId, "processing", 45, "👥 Analyzing speakers & extracting insights...");
            let diarizedTranscript = `Speaker 1: ${transcript}`;
            let aiInsights: any = {};

            try {
              const gptResponse = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                  {
                    role: "system",
                    content: `You are an expert multilingual meeting analyst and transcription assistant for a business CRM platform.
You will receive a raw Whisper transcript from a phone call or meeting. The audio may be in Hindi, Marathi, English, Hinglish, or mixed languages.

YOUR TWO TASKS:
1. Clean & reformat the transcript with accurate speaker labels
2. Extract structured business insights

═══ TRANSCRIPTION CLEANING RULES ═══
- Carefully identify distinct speakers from conversation flow (who asks vs who answers, topic shifts, tone)
- Label speakers as "Speaker 1:", "Speaker 2:" etc. If real names/roles are mentioned (e.g. "Rahul bhai", "Sir"), use those
- PRESERVE the exact original language — do NOT translate Hindi/Marathi/Hinglish to English
- Fix obvious Whisper errors (wrong words that don't fit context) using surrounding context
- Remove filler words: "umm", "uhh", "acha acha", repeated stutters
- De-duplicate repeated sentences (Whisper sometimes repeats)
- Mark truly unclear parts as [unclear]
- For phone calls: one party is often the agent/caller, other is client — label accordingly if evident
- Maintain natural paragraph breaks between speaker turns
- If Devanagari script is present, preserve it exactly as-is

═══ INSIGHT EXTRACTION RULES ═══
- Extract ONLY what is explicitly mentioned — never fabricate or assume
- Include exact numbers, amounts, dates, names whenever spoken
- For business context: capture product/service discussed, pricing, commitments made
- Empty array [] if a section has no relevant data — never fill with guesses
- sentiment: judge overall tone — "Positive", "Neutral", "Concerned", or "Critical"

Return ONLY valid JSON (no markdown, no explanation, no preamble):
{
  "diarizedTranscript": "Speaker 1: ...\nSpeaker 2: ...",
  "summary": "5-8 sentence summary covering: who spoke, purpose of call/meeting, key points discussed, decisions made, and outcome",
  "targets": ["specific target or goal with numbers/timeline if mentioned"],
  "achievements": ["achievement or milestone with data"],
  "responsiblePersons": ["Name/Role - their responsibility or commitment"],
  "kpis": ["Metric name - exact value mentioned"],
  "deadlines": ["Task or commitment - date or timeline mentioned"],
  "riskPoints": ["risk, concern, objection, or blocker raised"],
  "actionItems": ["specific action to be taken - who will do it"],
  "keyDecisions": ["decision or agreement reached"],
  "nextSteps": ["next step or follow-up agreed upon"],
  "clientMentions": ["client or company name - context of mention"],
  "keyFigures": ["description - exact value/amount/number"],
  "sentiment": "Positive|Neutral|Concerned|Critical"
}`

                  },
                  {
                    role: "user",
                    content: `Meeting Title: ${title}\n\nRaw Transcript:\n${transcript}`
                  }
                ],
                temperature: 0.2,
                max_tokens: 4000,
              });

              const raw = gptResponse.choices[0]?.message?.content?.trim() || "{}";
              const cleaned = raw.replace(/```json|```/g, "").trim();
              const parsed = JSON.parse(cleaned);

              if (parsed.diarizedTranscript?.trim()) {
                diarizedTranscript = parsed.diarizedTranscript;
              }
              const { diarizedTranscript: _dt, ...insightsOnly } = parsed;
              aiInsights = insightsOnly;

            } catch (err: any) {
              console.error("GPT analysis error:", err.message);
              aiInsights = { summary: "Transcription complete but AI analysis failed. Please retry.", sentiment: "Neutral" };
            }

                        // Step 4: Save to DB
            await storage.updateJob(jobId, "processing", 90, "💾 Saving results...");

            // Detect language
            const hindiCharCount = (diarizedTranscript.match(/[ऀ-ॿ]/g) || []).length;
            const totalChars = diarizedTranscript.replace(/\s/g, "").length;
            const language = totalChars > 0 && hindiCharCount / totalChars > 0.15 ? "Hindi/Hinglish" : "English";

            const meeting = await storage.createMeeting({
              agencyCode,
              title,
              audioFileName: originalName,
              transcript: diarizedTranscript,
              summary: aiInsights.summary || "",
              targets: aiInsights.targets || [],
              achievements: aiInsights.achievements || [],
              responsiblePersons: aiInsights.responsiblePersons || [],
              kpis: aiInsights.kpis || [],
              deadlines: aiInsights.deadlines || [],
              riskPoints: aiInsights.riskPoints || [],
              actionItems: aiInsights.actionItems || [],
              keyDecisions: aiInsights.keyDecisions || [],
              nextSteps: aiInsights.nextSteps || [],
              clientMentions: aiInsights.clientMentions || [],
              keyFigures: aiInsights.keyFigures || [],
              sentiment: aiInsights.sentiment || "Neutral",
              language,
              createdBy: userId,
            });

            await storage.updateJob(jobId, "done", 100, "✅ Analysis complete!", meeting);

            // Clean up job after 10 minutes
            setTimeout(() => storage.deleteJob(jobId), 10 * 60 * 1000);

          } catch (err: any) {
            console.error("Background job error:", err.message);
            try { fs.unlinkSync(filePath); } catch {}
            await storage.updateJob(jobId, "error", 0, `❌ Processing failed: ${err.message}`, undefined, err.message);
          }
        })();

        return; // Response already sent
      }

      if (!transcript || transcript.trim().length === 0) {
        return res.status(400).json({ success: false, message: "No transcript or audio provided" });
      }

      // Skip separate diarization — main GPT-4o call handles speaker labeling
      let diarizedTranscript = transcript;

      let aiInsights: any = {};
      try {
        const gptResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a senior AI business analyst specialising in multilingual call and meeting analysis. The transcript may contain Hindi, Marathi, English, Hinglish or mixed languages. Analyse thoroughly and extract detailed, actionable insights. Be specific — include exact names, numbers, amounts, dates, and context wherever mentioned. Never fabricate data. Return a JSON object with these exact fields:
- summary: Detailed 5-7 sentence executive summary covering: purpose of the call/meeting, who was involved, key topics discussed, decisions made, commitments given, and overall outcome
- targets: Specific targets or goals discussed (include numbers, percentages, timelines)
- achievements: Achievements, milestones, or progress reported (with data)
- responsiblePersons: People mentioned with their roles or responsibilities (format: "Name/Role - responsibility or commitment")
- kpis: KPIs, metrics, or performance indicators mentioned (format: "Metric - exact value")
- deadlines: Deadlines, timelines, or due dates mentioned (format: "Task - date or timeline")
- riskPoints: Risks, concerns, objections, blockers, or challenges raised (note severity if clear)
- actionItems: Specific actions or tasks to be done (format: "Action - owner if mentioned")
- keyDecisions: Important decisions, agreements, or commitments made
- nextSteps: Agreed next steps or follow-up actions
- clientMentions: Client, customer, or company names mentioned with context
- keyFigures: Important numbers, amounts, prices, percentages, or statistics (format: "description - exact value")
- sentiment: Overall tone in one word only: "Positive", "Neutral", "Concerned", or "Critical"
Return ONLY valid JSON, no markdown, no explanation.`
            },

            { role: "user", content: `Meeting Title: ${title}\n\nTranscript (with speakers identified):\n${diarizedTranscript}` }
          ],
          temperature: 0.3,
        });

        const content = gptResponse.choices[0]?.message?.content || "{}";
        aiInsights = JSON.parse(content.replace(/```json\n?|```\n?/g, "").trim());
      } catch (err: any) {
        console.error("GPT analysis error:", err.message);
        aiInsights = {
          summary: `Meeting: ${title} - Transcript recorded but AI analysis failed.`,
          targets: [], achievements: [], responsiblePersons: [],
          kpis: [], deadlines: [], riskPoints: [],
          actionItems: [], keyDecisions: [], nextSteps: [],
          clientMentions: [], keyFigures: [], sentiment: "Neutral",
        };
      }

      const meeting = await storage.createMeeting({
        agencyCode, title, audioFileName,
        transcript: diarizedTranscript,  // Speaker-labeled version
        // rawTranscript: transcript,  // Original raw transcript
        summary: aiInsights.summary || `Meeting: ${title}`,
        targets: aiInsights.targets || [],
        achievements: aiInsights.achievements || [],
        responsiblePersons: aiInsights.responsiblePersons || [],
        kpis: aiInsights.kpis || [],
        deadlines: aiInsights.deadlines || [],
        riskPoints: aiInsights.riskPoints || [],
        actionItems: aiInsights.actionItems || [],
        keyDecisions: aiInsights.keyDecisions || [],
        nextSteps: aiInsights.nextSteps || [],
        clientMentions: aiInsights.clientMentions || [],
        keyFigures: aiInsights.keyFigures || [],
        sentiment: aiInsights.sentiment || "Neutral",
        language: aiInsights.language || "English",
        createdBy: req.user!.id,
      });

      res.json({ success: true, data: meeting });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/meetings", authMiddleware, roleMiddleware("AGENCY_ADMIN", "MASTER_ADMIN","TEAM_LEADER"), async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role === "MASTER_ADMIN") {
        const agencyFilter = req.query.agency as string | undefined;
        let meetingsList;
        if (agencyFilter) {
          meetingsList = await storage.getMeetingsByAgency(agencyFilter);
        } else {
          meetingsList = await storage.getAllMeetings();
        }
        const allAgencies = await storage.getAllAgencies();
        const agencyMap: Record<string, string> = {};
        for (const a of allAgencies) {
          agencyMap[a.agencyCode] = a.name;
        }
        const enriched = meetingsList.map((m: any) => ({
          ...m,
          agencyName: agencyMap[m.agencyCode] || m.agencyCode,
        }));
        return res.json({ success: true, data: enriched });
      }

      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });

      const agency = await storage.getAgencyByCode(agencyCode);
      if (!agency || (agency.plan !== "PRO" && agency.plan !== "ENTERPRISE")) {
        return res.status(403).json({ success: false, message: "AI Proceeding requires PRO or ENTERPRISE plan" });
      }

      const meetingsList = await storage.getMeetingsByAgency(agencyCode);
      res.json({ success: true, data: meetingsList });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.delete("/api/meetings/:id", authMiddleware, roleMiddleware("MASTER_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const meeting = await storage.getMeeting(req.params.id);
      if (!meeting) return res.status(404).json({ success: false, message: "Meeting not found" });
      await storage.deleteMeeting(req.params.id);
      res.json({ success: true, message: "Meeting deleted" });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/dashboard", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role === "MASTER_ADMIN") {
        const allAgencies = await storage.getAllAgencies();
        const totalLeads = await Promise.all(allAgencies.map(a => storage.countLeadsByAgency(a.agencyCode)));
        const allUsers = await storage.getAllUsers();
        const pendingApprovals = allUsers.filter(u => u.status === "PENDING_APPROVAL").length;
        const pendingUpgrades = await storage.getAllUpgradeRequests();
        const pendingUpgradeCount = pendingUpgrades.filter(r => r.status === "PENDING").length;

        return res.json({
          success: true,
          data: {
            totalAgencies: allAgencies.length,
            activeAgencies: allAgencies.filter(a => a.isActive).length,
            inactiveAgencies: allAgencies.filter(a => !a.isActive).length,
            totalLeads: totalLeads.reduce((a, b) => a + b, 0),
            totalUsers: allUsers.length,
            pendingApprovals,
            pendingUpgradeRequests: pendingUpgradeCount,
            agencies: allAgencies.map((a, i) => ({ ...a, leadCount: totalLeads[i] }))
          }
        });
      }

      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });

      const agency = await storage.getAgencyByCode(agencyCode);
      const stats = await storage.getLeadStats(agencyCode, req.user!.role === "TELE_CALLER" ? req.user!.id : undefined);
      const totalLeads = Object.values(stats).reduce((a: number, b: number) => a + b, 0);
      const userCount = await storage.countUsersByAgency(agencyCode);

      const extraData: any = { agency, leadStats: stats, totalLeads, userCount };

      if (req.user!.role === "AGENCY_ADMIN") {
        const agencyServices = await storage.getServicesByAgency(agencyCode);
        extraData.services = agencyServices;

        const teamUsers = await storage.getUsersByAgency(agencyCode);
        const telecallers = teamUsers.filter(u => u.role === "TELE_CALLER" && u.status === "ACTIVE");
        const performances = await Promise.all(
          telecallers.map(async (tc) => {
            const perf = await storage.getPerformanceStats(agencyCode, tc.id);
            return { name: tc.fullName, score: perf.score, conversionRate: perf.conversionRate, totalLeads: perf.totalLeads };
          })
        );
        performances.sort((a, b) => b.score - a.score);
        extraData.telecallerPerformances = performances;
      }

      if (req.user!.role === "TEAM_LEADER") {
        const teamUsers = await storage.getUsersByAgency(agencyCode);
        const telecallers = teamUsers.filter(u => u.role === "TELE_CALLER" && u.status === "ACTIVE");
        const telecallerStats = await Promise.all(
          telecallers.map(async (tc) => {
            const tcStats = await storage.getLeadStats(agencyCode, tc.id);
            return { name: tc.fullName, ...tcStats };
          })
        );
        extraData.telecallerStats = telecallerStats;
      }

      if (req.user!.role === "TELE_CALLER") {
        const perf = await storage.getPerformanceStats(agencyCode, req.user!.id);
        extraData.performance = perf;
      }

      res.json({ success: true, data: extraData });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/download-project", (req: Request, res: Response) => {
    const zipPath = path.join(process.cwd(), "ica-crm-project.zip");
    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({ success: false, message: "ZIP file not found" });
    }
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=ica-crm-project.zip");
    fs.createReadStream(zipPath).pipe(res);
  });

  // ── RC Lookup Routes ──────────────────────────────────────────────────────

  // POST /api/rc-lookup — fetch RC details from API and save
  app.post("/api/rc-lookup", authMiddleware, roleMiddleware("AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { rcNumber } = req.body;
      if (!rcNumber || typeof rcNumber !== "string" || rcNumber.trim().length < 4) {
        return res.status(400).json({ success: false, message: "Valid RC number is required" });
      }

      const cleanRC = rcNumber.trim().toUpperCase();
      const agencyCode = req.user!.agencyCode!;

      // ── Plan limit check ──────────────────────────────────────────────────
      const agency = await storage.getAgencyByCode(agencyCode);
      if (!agency) return res.status(404).json({ success: false, message: "Agency not found" });

      const plan = agency.plan as string;
      const rcLimit = RC_LOOKUP_LIMITS[plan] ?? 0;

      if (rcLimit !== Infinity) {
        // Count RC lookups this month
        const allRecords = await storage.getRcRecordsByAgency(agencyCode);
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const thisMonthCount = allRecords.filter(r => new Date(r.createdAt!) >= startOfMonth).length;

        if (thisMonthCount >= rcLimit) {
          return res.status(403).json({
            success: false,
            message: `RC lookup limit reached. Your ${plan} plan allows ${rcLimit} lookups/month. Used: ${thisMonthCount}/${rcLimit}. Upgrade to get more lookups.`,
            used: thisMonthCount,
            limit: rcLimit,
            plan,
          });
        }
      }

      // Check if already looked up recently (within 24 hours) — save API credits
      const existing = await storage.getRcRecordByNumber(agencyCode, cleanRC);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (existing && new Date(existing.createdAt!) > oneDayAgo) {
        return res.json({ success: true, data: existing.rcData, cached: true, message: "Returned from cache (looked up within 24 hours)" });
      }

      // Check if API key is configured
      const apiKey = process.env.RC_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ success: false, message: "RC lookup API not configured. Please contact administrator to add RC_API_KEY." });
      }

      // Call RC lookup API (Surepass or similar)
      const apiUrl = process.env.RC_API_URL || "https://kyc-api.surepass.io/api/v1/rc/rc-full";
      const apiResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ id_number: cleanRC }),
      });

      if (!apiResponse.ok) {
        return res.status(apiResponse.status).json({ success: false, message: "RC API request failed. Please try again." });
      }

      const apiData = await apiResponse.json();

      if (apiData.error || !apiData.data?.result) {
        return res.status(400).json({ success: false, message: apiData.message || "Vehicle not found or invalid RC number." });
      }

      const rcData = apiData.data.result;

      // Save to database
      await storage.createRcRecord({
        agencyCode,
        rcNumber: cleanRC,
        rcData: rcData as any,
        lookedUpBy: req.user!.id,
      });

      // Audit log
      await storage.createAuditLog({
        agencyCode,
        leadId: null,
        userId: req.user!.id,
        action: `RC_LOOKUP: ${cleanRC}`,
        oldStatus: null,
        newStatus: null,
        remarks: `Looked up RC: ${cleanRC} — ${rcData.vehicle_details?.maker} ${rcData.vehicle_details?.model}`,
        targetUserId: null,
      });

      res.json({ success: true, data: rcData });
    } catch (error: any) {
      console.error("RC lookup error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // GET /api/rc-lookup — MASTER_ADMIN view all RC records across agencies
  app.get("/api/rc-lookup", authMiddleware, roleMiddleware("MASTER_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyFilter = req.query.agency as string | undefined;
      let records: any[];
      if (agencyFilter) {
        records = await storage.getRcRecordsByAgency(agencyFilter);
      } else {
        records = await storage.getAllRcRecords();
      }
      const allAgencies = await storage.getAllAgencies();
      const agencyMap: Record<string, string> = {};
      for (const a of allAgencies) { agencyMap[a.agencyCode] = a.name; }
      const enriched = records.map((r: any) => ({ ...r, agencyName: agencyMap[r.agencyCode] || r.agencyCode }));
      return res.json({ success: true, data: enriched });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // DELETE /api/rc-lookup/:id — MASTER_ADMIN delete RC record
  app.delete("/api/rc-lookup/:id", authMiddleware, roleMiddleware("MASTER_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      await storage.deleteRcRecord(req.params.id);
      res.json({ success: true, message: "RC record deleted" });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // GET /api/rc-records — get saved RC lookups for this agency
  app.get("/api/rc-records", authMiddleware, roleMiddleware("AGENCY_ADMIN", "TEAM_LEADER"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyForCheck = await storage.getAgencyByCode(req.user!.agencyCode!);
      if (!agencyForCheck || agencyForCheck.plan === "BASIC") {
        return res.status(403).json({ success: false, message: "RC Lookup requires PRO or ENTERPRISE plan" });
      }
      const agencyCode = req.user!.agencyCode!;
      const records = await storage.getRcRecordsByAgency(agencyCode);

      // Calculate this month's usage
      const agency = await storage.getAgencyByCode(agencyCode);
      const plan = agency?.plan as string || "BASIC";
      const limit = RC_LOOKUP_LIMITS[plan] ?? 0;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const used = records.filter(r => new Date(r.createdAt!) >= monthStart).length;

      res.json({
        success: true,
        data: records,
        meta: { used, limit: limit === Infinity ? 9999999 : limit, plan },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // ── Add-on Packs ──────────────────────────────────────────────────────────────

  const ADDON_PACKS: Record<string, { type: string; size: number; amount: number; label: string }> = {
    "rc_10":  { type: "RC",  size: 10,  amount: 9900,  label: "10 RC Lookups" },
    "rc_25":  { type: "RC",  size: 25,  amount: 19900, label: "25 RC Lookups" },
    "ai_5":   { type: "AI",  size: 5,   amount: 19900, label: "5 AI Proceedings" },
    "ai_15":  { type: "AI",  size: 15,  amount: 49900, label: "15 AI Proceedings" },
  };

  // POST /api/addons/create-order
  app.post("/api/addons/create-order", async (req: Request, res: Response) => {
    try {
      const { packId, agencyCode } = req.body;
      if (!packId || !agencyCode) return res.status(400).json({ success: false, message: "packId and agencyCode required" });
      const pack = ADDON_PACKS[packId];
      if (!pack) return res.status(400).json({ success: false, message: "Invalid pack" });
      const agency = await storage.getAgencyByCode(agencyCode);
      if (!agency) return res.status(404).json({ success: false, message: "Agency not found" });
      if (!agency.isActive) return res.status(403).json({ success: false, message: "Agency is inactive" });

      const order = await razorpay.orders.create({
        amount: pack.amount,
        currency: "INR",
        receipt: `addon_${agencyCode}_${Date.now()}`,
        notes: { agencyCode, packId, packType: pack.type, packSize: String(pack.size) },
      });

      const { sql: addonSql } = await import("drizzle-orm");
      const { db: addonDb } = await import("./db");
      await addonDb.execute(addonSql`INSERT INTO addon_purchases (agency_code, pack_type, pack_size, amount, razorpay_order_id, status) VALUES (${agencyCode}, ${pack.type}, ${pack.size}, ${pack.amount}, ${order.id}, 'CREATED')`);

      res.json({ success: true, data: { orderId: order.id, amount: pack.amount, currency: "INR", keyId: process.env.RAZORPAY_KEY_ID, agencyName: agency.name, packLabel: pack.label } });
    } catch (error: any) {
      console.error("Addon order error:", error);
      res.status(500).json({ success: false, message: "Failed to create order" });
    }
  });

  // POST /api/addons/verify
  app.post("/api/addons/verify", async (req: Request, res: Response) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSig = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!).update(body).digest("hex");
      if (expectedSig !== razorpay_signature) return res.status(400).json({ success: false, message: "Invalid signature" });

      const { sql: verifySql } = await import("drizzle-orm");
      const { db: verifyDb } = await import("./db");
      const result = await verifyDb.execute(verifySql`SELECT * FROM addon_purchases WHERE razorpay_order_id = ${razorpay_order_id} LIMIT 1`);
      const purchase = result.rows[0] as any;
      if (!purchase) return res.status(404).json({ success: false, message: "Order not found" });
      if (purchase.status === "PAID") return res.json({ success: true, message: "Already processed" });
      await verifyDb.execute(verifySql`UPDATE addon_purchases SET status = 'PAID', razorpay_payment_id = ${razorpay_payment_id} WHERE razorpay_order_id = ${razorpay_order_id}`);
      if (purchase.pack_type === "RC") {
        await verifyDb.execute(verifySql`UPDATE agencies SET rc_addon_credits = rc_addon_credits + ${purchase.pack_size} WHERE agency_code = ${purchase.agency_code}`);
      } else {
        await verifyDb.execute(verifySql`UPDATE agencies SET ai_addon_credits = ai_addon_credits + ${purchase.pack_size} WHERE agency_code = ${purchase.agency_code}`);
      }

      await storage.createAuditLog({
        agencyCode: purchase.agency_code, leadId: null, userId: "addon-payment",
        action: `ADDON_PURCHASED: ${purchase.pack_size} ${purchase.pack_type} credits`,
        oldStatus: null, newStatus: null,
        remarks: `Payment ID: ${razorpay_payment_id} | Amount: ₹${purchase.amount / 100}`,
        targetUserId: null,
      });

      res.json({ success: true, message: `${purchase.pack_size} ${purchase.pack_type} credits added` });
    } catch (error: any) {
      console.error("Addon verify error:", error);
      res.status(500).json({ success: false, message: "Verification failed" });
    }
  });

  // GET /api/addons/balance?agencyCode=xxx
  app.get("/api/addons/balance", async (req: Request, res: Response) => {
    try {
      const { agencyCode } = req.query;
      if (!agencyCode) return res.status(400).json({ success: false, message: "agencyCode required" });
      const agency = await storage.getAgencyByCode(agencyCode as string);
      if (!agency) return res.status(404).json({ success: false, message: "Agency not found" });
      res.json({ success: true, data: { rcAddonCredits: (agency as any).rcAddonCredits || 0, aiAddonCredits: (agency as any).aiAddonCredits || 0 } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // POST /api/addons/webhook — Razorpay auto-credit on payment
  app.post("/api/addons/webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
    try {
      const signature = req.headers["x-razorpay-signature"] as string;
      const addonSecret = process.env.ADDON_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET!;
      const expectedSig = crypto.createHmac("sha256", addonSecret).update(req.body).digest("hex");
      if (expectedSig !== signature) return res.status(400).json({ success: false });
      const event = JSON.parse(req.body.toString());
      if (event.event === "payment.captured") {
        const payment = event.payload.payment.entity;
        const notes = payment.notes || {};
        if (notes.packId) {
          const { sql } = require("drizzle-orm");
          const result = await storage.db.execute(sql`SELECT * FROM addon_purchases WHERE razorpay_order_id = ${payment.order_id} LIMIT 1`);
          const purchase = result.rows[0] as any;
          if (purchase && purchase.status !== "PAID") {
            await storage.db.execute(sql`UPDATE addon_purchases SET status = 'PAID', razorpay_payment_id = ${payment.id} WHERE razorpay_order_id = ${payment.order_id}`);
            if (purchase.pack_type === "RC") {
              await storage.db.execute(sql`UPDATE agencies SET rc_addon_credits = rc_addon_credits + ${purchase.pack_size} WHERE agency_code = ${purchase.agency_code}`);
            } else {
              await storage.db.execute(sql`UPDATE agencies SET ai_addon_credits = ai_addon_credits + ${purchase.pack_size} WHERE agency_code = ${purchase.agency_code}`);
            }
            console.log(`[Addon Webhook] ${purchase.pack_size} ${purchase.pack_type} credits added to ${purchase.agency_code}`);
          }
        }
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Addon webhook error:", error);
      res.status(200).json({ success: true });
    }
  });

  // ── AI Features ────────────────────────────────────────────────────────────────


// POST /api/ai/suggest-remark
app.post("/api/ai/suggest-remark", authMiddleware, roleMiddleware("TELE_CALLER", "TEAM_LEADER", "AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const agencyCode = req.user!.agencyCode;
    if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });

    const agency = await storage.getAgencyByCode(agencyCode);
    if (!agency || agency.plan === "BASIC") {
      return res.status(403).json({ success: false, message: "AI features require PRO or ENTERPRISE plan" });
    }

    const { leadName, phone, service, status, previousRemark, polishMode } = req.body;
    if (!leadName || !status) return res.status(400).json({ success: false, message: "Lead name and status required" });

    const businessContext = [
      agency.businessProfile ? `Agency profile: ${agency.businessProfile}` : "",
      agency.businessServices ? `Services offered: ${agency.businessServices}` : "",
    ].filter(Boolean).join("\n");

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: polishMode && previousRemark
          ? `You are a CRM assistant. Rewrite this remark professionally for an insurance telecaller. Status is ${status}. CONVERTED means policy sold — use confident past tense like "Customer agreed", "Policy confirmed", "Sale completed". Do NOT suggest follow-ups for CONVERTED. Return ONLY the rewritten remark. No extra text, no quotes, no options.\nOriginal remark: ${previousRemark}`
          : `You are a CRM assistant for an Indian insurance/financial services agency. Write a short, professional call remark in English (2-3 sentences max) for a telecaller to log after a call.\n${businessContext ? `Agency context:\n${businessContext}\n` : ""}Lead details:\n- Name: ${leadName}\n- Service interested in: ${service || "General inquiry"}\n- Call outcome: ${status}\n- Previous remark: ${previousRemark || "None"}\nWrite only the remark text, nothing else. Keep it factual, professional, and specific to the outcome.`
      }]
    });

    const remark = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    res.json({ success: true, remark });
  } catch (error: any) {
    console.error("AI remark error:", error);
    res.status(500).json({ success: false, message: "AI service error" });
  }
});

// POST /api/ai/followup-message
app.post("/api/ai/followup-message", authMiddleware, roleMiddleware("TELE_CALLER", "TEAM_LEADER", "AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const agencyCode = req.user!.agencyCode;
    if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });

    const agency = await storage.getAgencyByCode(agencyCode);
    if (!agency || agency.plan === "BASIC") {
      return res.status(403).json({ success: false, message: "AI features require PRO or ENTERPRISE plan" });
    }

    const { leadName, service, status, previousRemark, messageType } = req.body;
    if (!leadName) return res.status(400).json({ success: false, message: "Lead name required" });

    const businessContext2 = [
      agency.businessProfile ? `Agency profile: ${agency.businessProfile}` : "",
      agency.businessServices ? `Services offered: ${agency.businessServices}` : "",
    ].filter(Boolean).join("\n");

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `You are a CRM assistant for an Indian insurance/financial services agency. Write a ${messageType === "whatsapp" ? "WhatsApp message" : "call script"} in Hinglish or English (as appropriate for Indian clients).

${businessContext2 ? `Agency context:\n${businessContext2}\n` : ""}Lead details:
- Name: ${leadName}
- Service: ${service || "financial services"}
- Current status: ${status || "NEW"}
- Last remark: ${previousRemark || "First contact"}

Rules:
- WhatsApp: friendly, short (3-4 lines max), end with a soft call to action
- Call script: natural opening, mention service, ask open question
- Use "Namaste" or "Hello" as greeting
- Never be pushy
- Personalise message based on the agency's actual services and profile
- Write only the message/script, nothing else`
      }]
    });

    const result = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    res.json({ success: true, message: result });
  } catch (error: any) {
    console.error("AI followup error:", error);
    res.status(500).json({ success: false, message: "AI service error" });
  }
});

// POST /api/ai/score-lead
app.post("/api/ai/score-lead", authMiddleware, roleMiddleware("TELE_CALLER", "TEAM_LEADER", "AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const agencyCode = req.user!.agencyCode;
    if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });

    const agency = await storage.getAgencyByCode(agencyCode);
    if (!agency || agency.plan === "BASIC") {
      return res.status(403).json({ success: false, message: "AI features require PRO or ENTERPRISE plan" });
    }

    const { leadName, service, status, followUpDate, remarks, source } = req.body;

    const businessContext3 = [
      agency.businessProfile ? `Agency profile: ${agency.businessProfile}` : "",
      agency.businessServices ? `Agency specialises in: ${agency.businessServices}` : "",
    ].filter(Boolean).join("\n");

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{
        role: "user",
        content: `You are a lead scoring AI for an Indian insurance/financial services CRM. Score this lead from 1-100 for conversion likelihood and give a one-line reason.

${businessContext3 ? `Agency context:\n${businessContext3}\n` : ""}Lead:
- Name: ${leadName}
- Service: ${service || "unknown"}
- Status: ${status}
- Source: ${source || "unknown"}
- Follow-up date: ${followUpDate ? new Date(followUpDate).toLocaleDateString() : "not set"}
- Last remark: ${remarks || "none"}

Scoring guide:
- CONVERTED = 95+
- FOLLOW_UP with future date = 65-80
- CONTACTED with remarks = 45-65
- NEW from referral = 50-60
- NEW from cold call = 20-35
- NOT_INTERESTED = 5-15
- Boost score if the lead's service matches the agency's core specialisation

Return ONLY valid JSON: {"score": number, "reason": "one line reason", "label": "Hot|Warm|Cold"}`
      }]
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    res.json({ success: true, score: parsed.score, reason: parsed.reason, label: parsed.label });
  } catch (error: any) {
    console.error("AI score error:", error);
    res.status(500).json({ success: false, message: "AI service error" });
  }
});

// POST /api/ai/chat
app.post("/api/ai/chat", authMiddleware, roleMiddleware("AGENCY_ADMIN", "MASTER_ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const agencyCode = req.user!.agencyCode;

    if (req.user!.role !== "MASTER_ADMIN") {
      const agency = await storage.getAgencyByCode(agencyCode!);
      if (!agency || agency.plan !== "ENTERPRISE") {
        return res.status(403).json({ success: false, message: "AI Chatbot requires ENTERPRISE plan" });
      }
    }

    const { question, context } = req.body;
    if (!question) return res.status(400).json({ success: false, message: "Question required" });

    // Fetch live CRM data for context
    let crmContext = "";
    if (agencyCode) {
      const stats = await storage.getLeadStats(agencyCode);
      const total = Object.values(stats).reduce((a: number, b: number) => a + b, 0);
      crmContext = `Current CRM data for this agency:
- Total leads: ${total}
- New: ${stats.NEW}, Contacted: ${stats.CONTACTED}, Follow-up: ${stats.FOLLOW_UP}
- Converted: ${stats.CONVERTED}, Not interested: ${stats.NOT_INTERESTED}
- Conversion rate: ${total > 0 ? ((stats.CONVERTED / total) * 100).toFixed(1) : 0}%`;
    }

    // Inject business profile into chatbot system context
    const agency2 = agencyCode ? await storage.getAgencyByCode(agencyCode) : null;
    const businessContext4 = agency2 ? [
      agency2.businessProfile ? `Agency profile: ${agency2.businessProfile}` : "",
      agency2.businessServices ? `Services offered: ${agency2.businessServices}` : "",
    ].filter(Boolean).join("\n") : "";

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: `You are an intelligent CRM assistant for ICA CRM, an insurance agency management platform. You help agency admins understand their lead data, team performance, and suggest actionable improvements. Be concise, specific, and use Indian business context. Always give practical advice.

${businessContext4 ? `About this agency:\n${businessContext4}\n` : ""}${crmContext}`,
      messages: [{
        role: "user",
        content: question
      }]
    });

    const answer = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    res.json({ success: true, answer });
  } catch (error: any) {
    console.error("AI chat error:", error);
    res.status(500).json({ success: false, message: "AI service error" });
  }
});
  // ── Agency Business Profile API ───────────────────────────────────────────

  // GET /api/agency/profile — AGENCY_ADMIN gets own profile
  app.get("/api/agency/profile", authMiddleware, roleMiddleware("AGENCY_ADMIN", "TEAM_LEADER", "TELE_CALLER"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });
      const agency = await storage.getAgencyByCode(agencyCode);
      if (!agency) return res.status(404).json({ success: false, message: "Agency not found" });
      res.json({ success: true, data: { businessProfile: agency.businessProfile, businessServices: agency.businessServices, name: agency.name } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // PATCH /api/agency/profile — AGENCY_ADMIN updates own profile
  app.patch("/api/agency/profile", authMiddleware, roleMiddleware("AGENCY_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyCode = req.user!.agencyCode;
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });
      const { businessProfile, businessServices } = req.body;
      const agency = await storage.getAgencyByCode(agencyCode);
      if (!agency) return res.status(404).json({ success: false, message: "Agency not found" });
      await storage.updateAgency(agency.id, { businessProfile, businessServices });
      res.json({ success: true, message: "Business profile updated" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // ── Email API Endpoints ────────────────────────────────────────────────────

  // Public contact form from website — no auth required
  app.post("/api/contact", async (req: Request, res: Response) => {
    try {
      const { name, phone, email, interest, message } = req.body;
      if (!name || !phone) return res.status(400).json({ success: false, message: "Name and phone required" });

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9f9f9;border-radius:12px;">
          <div style="background:#0d1b4b;padding:20px 24px;border-radius:8px 8px 0 0;">
            <h2 style="color:#00c853;margin:0;font-size:20px;">New Website Inquiry</h2>
            <p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:13px;">icaweb.in Contact Form</p>
          </div>
          <div style="background:#ffffff;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e5e5;border-top:none;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#666;font-size:13px;width:120px;">Name</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:14px;">${name}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#666;font-size:13px;">Phone</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:14px;"><a href="tel:${phone}" style="color:#0d1b4b;">${phone}</a></td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#666;font-size:13px;">Email</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;">${email || "—"}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#666;font-size:13px;">Interest</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;"><span style="background:#e8f5e9;color:#2e7d32;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">${interest || "—"}</span></td></tr>
              <tr><td style="padding:10px 0;color:#666;font-size:13px;">Message</td><td style="padding:10px 0;font-size:14px;color:#333;">${message || "—"}</td></tr>
            </table>
            <div style="margin-top:20px;padding:12px 16px;background:#e8f5e9;border-radius:8px;font-size:13px;color:#2e7d32;">
              <strong>Quick Reply:</strong> <a href="WALINK" style="color:#2e7d32;">Reply on WhatsApp →</a>
            </div>
          </div>
          <p style="text-align:center;color:#aaa;font-size:11px;margin-top:16px;">ICA — Innovation, Consulting & Automation · icaweb.in</p>
        </div>`;

      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const waLink = `https://wa.me/91${cleanPhone}?text=Hi%20${name}%2C%20thanks%20for%20your%20interest%20in%20ICA%20CRM!`;
      const finalHtml = html.replace('WALINK', waLink);
      const sent = await sendEmail("support@icaweb.in", `New Inquiry: ${name} — ${interest || "ICA Products"}`, finalHtml);
      console.log(`Contact form: ${name} ${phone} — email sent: ${sent}`);
      res.json({ success: true, message: "Inquiry received" });
    } catch (error: any) {
      console.error("Contact form error:", error);
      res.status(500).json({ success: false, message: "Failed to send" });
    }
  });

  // Send prospect inquiry email
  app.post("/api/email/prospect", authMiddleware, roleMiddleware("MASTER_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { to, name } = req.body;
      if (!to || !name) return res.status(400).json({ success: false, message: "Email and name required" });
      const sent = await sendProspectEmail(to, name);
      res.json({ success: sent, message: sent ? "Prospect email sent!" : "Failed to send email" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Send welcome email manually
  app.post("/api/email/welcome", authMiddleware, roleMiddleware("MASTER_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { to, fullName, username, agencyCode } = req.body;
      if (!to || !fullName || !username || !agencyCode) return res.status(400).json({ success: false, message: "Missing fields" });
      const agency = await storage.getAgencyByCode(agencyCode);
      if (!agency) return res.status(404).json({ success: false, message: "Agency not found" });
      const sent = await sendWelcomeEmail(to, fullName, username, "", "AGENCY_ADMIN", agency.plan, agency.name);
      res.json({ success: sent, message: sent ? "Welcome email sent!" : "Failed to send email" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/seed", async (req: Request, res: Response) => {
    // Block seed endpoint in production for security
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    try {
      const existing = await storage.getUserByUsername("masteradmin");
      if (existing) return res.json({ success: true, message: "Already seeded" });

      const hashedPassword = await bcrypt.hash("admin123", 10);
      await storage.createUser({
        username: "masteradmin", password: hashedPassword,
        fullName: "Master Administrator", email: "admin@ica-crm.com",
        mobile: "9967969850",
        role: "MASTER_ADMIN", agencyCode: null, isActive: true, status: "ACTIVE",
      });

      await storage.createAgency({
        name: "ICA Demo Agency", agencyCode: "ICA-DEMO01",
        plan: "PRO", isActive: true, leadLimit: 1000, userLimit: 20,
      });

      const adminPassword = await bcrypt.hash("agency123", 10);
      await storage.createUser({
        username: "agencyadmin", password: adminPassword,
        fullName: "Agency Administrator", email: "agency@ica-crm.com",
        mobile: "9876543200",
        role: "AGENCY_ADMIN", agencyCode: "ICA-DEMO01", isActive: true, status: "ACTIVE",
      });

      const tlPassword = await bcrypt.hash("team123", 10);
      const teamLead = await storage.createUser({
        username: "teamlead1", password: tlPassword,
        fullName: "Rajesh Kumar", email: "rajesh@ica-crm.com",
        mobile: "9876543201",
        role: "TEAM_LEADER", agencyCode: "ICA-DEMO01", isActive: true, status: "ACTIVE",
      });

      const tcPassword = await bcrypt.hash("caller123", 10);
      const tc1 = await storage.createUser({
        username: "telecaller1", password: tcPassword,
        fullName: "Priya Sharma", email: "priya@ica-crm.com",
        mobile: "9876543202",
        role: "TELE_CALLER", agencyCode: "ICA-DEMO01", isActive: true, status: "ACTIVE",
      });
      const tc2 = await storage.createUser({
        username: "telecaller2", password: await bcrypt.hash("caller123", 10),
        fullName: "Amit Patel", email: "amit@ica-crm.com",
        mobile: "9876543203",
        role: "TELE_CALLER", agencyCode: "ICA-DEMO01", isActive: true, status: "ACTIVE",
      });
      const tc3 = await storage.createUser({
        username: "telecaller3", password: await bcrypt.hash("caller123", 10),
        fullName: "Sneha Reddy", email: "sneha@ica-crm.com",
        mobile: "9876543204",
        role: "TELE_CALLER", agencyCode: "ICA-DEMO01", isActive: true, status: "ACTIVE",
      });

      await storage.createService({ agencyCode: "ICA-DEMO01", name: "Insurance" });
      await storage.createService({ agencyCode: "ICA-DEMO01", name: "Loan" });
      await storage.createService({ agencyCode: "ICA-DEMO01", name: "Software" });

      const sampleLeads = [
        { name: "Vikram Singh", phone: "9876543210", email: "vikram@email.com", source: "Website", status: "NEW", service: "Insurance" },
        { name: "Anita Desai", phone: "9876543211", email: "anita@email.com", source: "Referral", status: "CONTACTED", assignedTo: tc1.id, service: "Loan" },
        { name: "Rahul Mehta", phone: "9876543212", email: "rahul@email.com", source: "Cold Call", status: "FOLLOW_UP", assignedTo: tc1.id, followUpDate: new Date(Date.now() + 86400000), service: "Insurance" },
        { name: "Meena Kapoor", phone: "9876543213", email: "meena@email.com", source: "Social Media", status: "CONVERTED", assignedTo: tc2.id, service: "Software" },
        { name: "Suresh Nair", phone: "9876543214", email: "suresh@email.com", source: "Website", status: "NOT_INTERESTED", assignedTo: tc2.id, service: "Insurance" },
        { name: "Kavitha Iyer", phone: "9876543215", email: "kavitha@email.com", source: "Referral", status: "NEW", service: "Loan" },
        { name: "Deepak Joshi", phone: "9876543216", email: "deepak@email.com", source: "Exhibition", status: "CONTACTED", assignedTo: tc3.id, service: "Insurance" },
        { name: "Pooja Gupta", phone: "9876543217", email: "pooja@email.com", source: "Website", status: "FOLLOW_UP", assignedTo: tc3.id, followUpDate: new Date(Date.now() + 172800000), service: "Software" },
        { name: "Arjun Rao", phone: "9876543218", email: "arjun@email.com", source: "Cold Call", status: "CONVERTED", assignedTo: tc1.id, service: "Insurance" },
        { name: "Lakshmi Bhat", phone: "9876543219", email: "lakshmi@email.com", source: "Social Media", status: "NEW", service: "Loan" },
        { name: "Ravi Verma", phone: "9876543220", email: "ravi@email.com", source: "Referral", status: "CONTACTED", assignedTo: tc1.id, service: "Insurance" },
        { name: "Sunita Choudhary", phone: "9876543221", email: "sunita@email.com", source: "Website", status: "FOLLOW_UP", assignedTo: tc2.id, followUpDate: new Date(Date.now() - 86400000), service: "Software" },
      ];

      for (const lead of sampleLeads) {
        await storage.createLead({
          ...lead, agencyCode: "ICA-DEMO01", createdBy: teamLead.id,
          remarks: null, followUpDate: lead.followUpDate || null,
          assignedTo: lead.assignedTo || null, email: lead.email || null,
          source: lead.source || null, service: lead.service || null,
        });
      }

      res.json({ success: true, message: "Demo data seeded successfully" });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // ── Payment Routes ────────────────────────────────────────────────────────

  // POST /api/payments/create-order
  app.post("/api/payments/create-order", authMiddleware, roleMiddleware("AGENCY_ADMIN", "MASTER_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { plan, agencyCode: targetAgencyCode } = req.body;
      if (!plan || !PLAN_PRICES[plan]) {
        return res.status(400).json({ success: false, message: "Invalid plan" });
      }
      const agencyCode = req.user!.role === "MASTER_ADMIN" ? targetAgencyCode : req.user!.agencyCode!;
      if (!agencyCode) return res.status(400).json({ success: false, message: "Agency code required" });
      const agency = await storage.getAgencyByCode(agencyCode);
      if (!agency) return res.status(404).json({ success: false, message: "Agency not found" });
      const amount = PLAN_PRICES[plan];
      const order = await razorpay.orders.create({
        amount,
        currency: "INR",
        receipt: `ica_${agencyCode}_${Date.now()}`,
        notes: { agencyCode, plan, agencyName: agency.name },
      });
      await storage.createPayment({
        agencyCode,
        razorpayOrderId: order.id,
        amount,
        currency: "INR",
        plan,
        status: "CREATED",
        createdBy: req.user!.id,
      });
      res.json({ success: true, data: { orderId: order.id, amount, currency: "INR", keyId: process.env.RAZORPAY_KEY_ID, agencyName: agency.name, plan } });
    } catch (error: any) {
      console.error("Create order error:", error);
      res.status(500).json({ success: false, message: "Failed to create payment order" });
    }
  });

  // POST /api/payments/verify
  app.post("/api/payments/verify", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!).update(body).digest("hex");
      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, message: "Invalid payment signature" });
      }
      const payment = await storage.getPaymentByOrderId(razorpay_order_id);
      if (!payment) return res.status(404).json({ success: false, message: "Order not found" });
      await storage.updatePayment(razorpay_order_id, {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: "PAID",
        updatedAt: new Date(),
      });
      const agency = await storage.getAgencyByCode(payment.agencyCode);
      if (agency) {
        const limits = PLAN_LIMITS[payment.plan] || {};
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + 30);
        await storage.updateAgency(agency.id, { plan: payment.plan, ...limits, planAssignedAt: new Date(), isActive: true, subscriptionExpiry: newExpiry });
        try {
          const agencyUsers = await storage.getUsersByAgency(payment.agencyCode);
          const adminUser = agencyUsers.find((u: any) => u.role === "AGENCY_ADMIN");
          if (adminUser?.email) {
            await sendPaymentSuccessEmail(adminUser.email, adminUser.fullName, payment.plan, payment.amount / 100, razorpay_payment_id);
          }
        } catch (emailErr) { console.error("Payment email failed:", emailErr); }
        await storage.createAuditLog({
          agencyCode: payment.agencyCode, leadId: null, userId: req.user!.id,
          action: "PLAN_UPGRADED_VIA_PAYMENT", oldStatus: agency.plan, newStatus: payment.plan,
          remarks: `Payment ID: ${razorpay_payment_id} | Amount: Rs.${payment.amount / 100}`,
          targetUserId: null,
        });
      }
      res.json({ success: true, message: "Payment verified and plan upgraded" });
    } catch (error: any) {
      console.error("Verify error:", error);
      res.status(500).json({ success: false, message: "Payment verification failed" });
    }
  });

  // POST /api/payments/website-order — create order from icaweb.in (public, no auth)
  app.post("/api/payments/website-order", async (req: Request, res: Response) => {
    try {
      const { plan, agencyCode, name, email } = req.body;
      const planUpper = (plan || "").toUpperCase();
      if (!planUpper || !PLAN_PRICES[planUpper]) {
        return res.status(400).json({ success: false, message: "Invalid plan" });
      }
      const amount = PLAN_PRICES[planUpper];
      const receipt = `web_${agencyCode || "new"}_${Date.now()}`;
      const order = await razorpay.orders.create({
        amount,
        currency: "INR",
        receipt,
        notes: { agencyCode: agencyCode || "", plan: planUpper, name: name || "", email: email || "" },
      });
      res.json({ success: true, data: { orderId: order.id, amount, currency: "INR", keyId: process.env.RAZORPAY_KEY_ID, plan: planUpper } });
    } catch (err: any) {
      console.error("website-order error:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST /api/payments/website-renew — auto-activate after icaweb.in payment
  app.post("/api/payments/website-renew", async (req: Request, res: Response) => {
    try {
      const { agencyCode, plan, razorpay_payment_id, email, name } = req.body;
      if (!agencyCode || !plan || !razorpay_payment_id) {
        return res.status(400).json({ success: false, message: "Missing fields" });
      }
      const agency = await storage.getAgencyByCode(agencyCode.toUpperCase());
      if (!agency) return res.status(404).json({ success: false, message: "Agency not found" });
      const limits = PLAN_LIMITS[plan] || {};
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 30);
      await storage.updateAgency(agency.id, {
        plan, ...limits, planAssignedAt: new Date(),
        isActive: true, subscriptionExpiry: newExpiry
      });
      // Record payment in payments table
      const planAmounts: Record<string, number> = { BASIC: 250000, PRO: 550000, ENTERPRISE: 1200000 };
      const planUpper = plan.toUpperCase();
      await storage.createPayment({
        agencyCode: agencyCode.toUpperCase(),
        razorpayOrderId: razorpay_payment_id,
        razorpayPaymentId: razorpay_payment_id,
        amount: planAmounts[planUpper] || 0,
        currency: "INR",
        plan: planUpper,
        status: "PAID",
        createdBy: name || "website-renew",
      });
      // Send payment success email
      try {
        const agencyUsers = await storage.getUsersByAgency(agencyCode);
        const adminUser = agencyUsers.find((u: any) => u.role === "AGENCY_ADMIN");
        const toEmail = adminUser?.email || email;
        const toName = adminUser?.fullName || name;
        if (toEmail) {
          await sendPaymentSuccessEmail(toEmail, toName, planUpper, planAmounts[planUpper] / 100 || 0, razorpay_payment_id);
        }
      } catch (emailErr) { console.error("Renewal email failed:", emailErr); }
      console.log(`[website-renew] Agency ${agencyCode} renewed on ${plan} until ${newExpiry}`);
      res.json({ success: true, message: "Agency renewed successfully" });
    } catch (err: any) {
      console.error("website-renew error:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST /api/payments/webhook
  app.post("/api/payments/webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;
      const signature = req.headers["x-razorpay-signature"] as string;
      const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(req.body).digest("hex");
      if (expectedSignature !== signature) {
        return res.status(400).json({ success: false, message: "Invalid webhook signature" });
      }
      const event = JSON.parse(req.body.toString());
      if (event.event === "payment.captured") {
        const paymentEntity = event.payload.payment.entity;
        const orderId = paymentEntity.order_id;
        const payment = await storage.getPaymentByOrderId(orderId);
        if (payment && payment.status !== "PAID") {
          await storage.updatePayment(orderId, { razorpayPaymentId: paymentEntity.id, status: "PAID", updatedAt: new Date() });
          const agency = await storage.getAgencyByCode(payment.agencyCode);
          if (agency) {
            const limits = PLAN_LIMITS[payment.plan] || {};
            await storage.updateAgency(agency.id, { plan: payment.plan, ...limits, planAssignedAt: new Date() });
            console.log("Webhook: Plan upgraded for", payment.agencyCode, "to", payment.plan);
          }
        }
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.status(500).json({ success: false });
    }
  });

  // POST /api/payments/send-link — Master Admin sends payment link to agency
  app.post("/api/payments/send-link", authMiddleware, roleMiddleware("MASTER_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { agencyCode, plan } = req.body;
      if (!agencyCode || !plan) return res.status(400).json({ success: false, message: "Agency and plan required" });
      const agency = await storage.getAgencyByCode(agencyCode);
      if (!agency) return res.status(404).json({ success: false, message: "Agency not found" });
      const amount = PLAN_PRICES[plan];
      const order = await razorpay.orders.create({
        amount, currency: "INR",
        receipt: `ica_${agencyCode}_${Date.now()}`,
        notes: { agencyCode, plan, agencyName: agency.name },
      });
      await storage.createPayment({ agencyCode, razorpayOrderId: order.id, amount, currency: "INR", plan, status: "CREATED", createdBy: req.user!.id });
      const agencyUsers = await storage.getUsersByAgency(agencyCode);
      const adminUser = agencyUsers.find((u: any) => u.role === "AGENCY_ADMIN");
      let emailSent = false;
      if (adminUser?.email) {
        try {
          const paymentUrl = `https://crm.icaweb.in/payment?orderId=${order.id}&plan=${plan}&amount=${amount}`;
          await sendPaymentLinkEmail(adminUser.email, adminUser.fullName, plan, amount / 100, paymentUrl);
          emailSent = true;
        } catch (emailErr: any) {
          console.error("Payment link email failed:", emailErr.message);
        }
      }
      res.json({ success: true, message: emailSent ? "Payment link sent to agency admin email" : "Order created but email failed — copy this link: https://crm.icaweb.in/payment?orderId=" + order.id + "&plan=" + plan + "&amount=" + amount });
    } catch (error: any) {
      console.error("Send link error:", error);
      res.status(500).json({ success: false, message: "Failed to send payment link" });
    }
  });

  // GET /api/payments — payment history
  app.get("/api/payments", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role === "MASTER_ADMIN") {
        const page  = parseInt(req.query.page  as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const result = await storage.getPaymentsPaginated(page, limit);
        const allAgencies = await storage.getAllAgencies();
        const agencyMap: Record<string, string> = {};
        for (const a of allAgencies) { agencyMap[a.agencyCode] = a.name; }
        const enriched = result.payments.map((p: any) => ({ ...p, agencyName: agencyMap[p.agencyCode] || p.agencyCode }));
        return res.json({ success: true, data: enriched, total: result.total, page, limit });
      }
      const records = await storage.getPaymentsByAgency(req.user!.agencyCode!);
      res.json({ success: true, data: records });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });
  // ── Subscription Status ───────────────────────────────────────────────────
  // GET /api/subscription/status
  app.get("/api/subscription/status", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { agencyCode, role } = req.user!;
      if (role === "MASTER_ADMIN") {
        return res.json({ success: true, data: { status: "ACTIVE", isMaster: true } });
      }
      if (!agencyCode) return res.status(400).json({ success: false, message: "No agency" });

      const agency = await storage.getAgencyByCode(agencyCode);
      if (!agency) return res.status(404).json({ success: false, message: "Agency not found" });

      const now = new Date();
      const expiry = agency.subscriptionExpiry ? new Date(agency.subscriptionExpiry) : null;
      const daysLeft = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
      const isExpired = expiry ? now > expiry : false;

      // Auto-mark expired in DB
      if (isExpired && agency.subscriptionStatus === "ACTIVE") {
        await storage.updateAgencyByCode(agencyCode, { subscriptionStatus: "EXPIRED" });
      }

      return res.json({
        success: true,
        data: {
          plan: agency.plan,
          status: isExpired ? "EXPIRED" : (agency.subscriptionStatus || "TRIAL"),
          expiry: expiry?.toISOString() || null,
          daysLeft: isExpired ? 0 : daysLeft,
          isExpired,
          isTrial: agency.subscriptionStatus === "TRIAL" || !agency.subscriptionStatus,
        }
      });
    } catch (error: any) {
      console.error("Subscription status error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // ── Manual Extend Subscription (MASTER_ADMIN) ─────────────────────────────
  // POST /api/subscription/extend
  app.post("/api/subscription/extend", authMiddleware, roleMiddleware("MASTER_ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { agencyCode, days = 30, plan } = req.body;
      if (!agencyCode) return res.status(400).json({ success: false, message: "agencyCode required" });

      const agency = await storage.getAgencyByCode(agencyCode);
      if (!agency) return res.status(404).json({ success: false, message: "Agency not found" });

      // Extend from current expiry (if future) or from now
      const base = agency.subscriptionExpiry && new Date(agency.subscriptionExpiry) > new Date()
        ? new Date(agency.subscriptionExpiry)
        : new Date();

      const newExpiry = new Date(base);
      newExpiry.setDate(newExpiry.getDate() + parseInt(days));

      const updateData: any = {
        subscriptionStatus: "ACTIVE",
        subscriptionExpiry: newExpiry,
      };
      if (plan) updateData.plan = plan.toUpperCase();

      await storage.updateAgencyByCode(agencyCode, updateData);

      await storage.createAuditLog({
        agencyCode,
        leadId: null,
        userId: req.user!.id,
        action: "SUBSCRIPTION_EXTENDED",
        oldStatus: agency.subscriptionStatus || "TRIAL",
        newStatus: "ACTIVE",
        remarks: `Extended by ${days} days. New expiry: ${newExpiry.toDateString()}${plan ? ` | Plan changed to: ${plan}` : ""}`,
        targetUserId: null,
      });

      return res.json({
        success: true,
        data: {
          agencyCode,
          newExpiry: newExpiry.toISOString(),
          daysExtended: parseInt(days),
          plan: plan || agency.plan,
        }
      });
    } catch (error: any) {
      console.error("Extend subscription error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // ── Subscription Webhook (Razorpay payment.captured) ──────────────────────
  // This extends the subscription on successful payment from website or CRM
  // POST /api/subscription/webhook
  app.post("/api/subscription/webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
    try {
      const signature = req.headers["x-razorpay-signature"] as string;
      const webhookSecret = process.env.RAZORPAY_KEY_SECRET!;

      // Verify signature
      if (webhookSecret && signature) {
        const expectedSig = crypto.createHmac("sha256", webhookSecret).update(req.body).digest("hex");
        if (expectedSig !== signature) {
          console.error("Subscription webhook: signature mismatch");
          return res.status(400).json({ success: false, message: "Invalid signature" });
        }
      }

      const event = JSON.parse(req.body.toString());
      console.log("[Subscription Webhook] Event:", event.event);

      if (event.event === "payment.captured") {
        const payment = event.payload.payment.entity;
        const notes = payment.notes || {};
        const agencyCode = notes.agency_code;
        const plan = (notes.plan || "BASIC").toUpperCase();
        const paymentId = payment.id;
        const amount = payment.amount;

        if (!agencyCode) {
          console.log("[Subscription Webhook] No agency_code in notes — skipping auto-activate");
          return res.status(200).json({ success: true });
        }

        const agency = await storage.getAgencyByCode(agencyCode);
        if (!agency) {
          console.error("[Subscription Webhook] Agency not found:", agencyCode);
          return res.status(200).json({ success: true });
        }

        // Extend subscription 30 days from now or from current expiry
        const base = agency.subscriptionExpiry && new Date(agency.subscriptionExpiry) > new Date()
          ? new Date(agency.subscriptionExpiry)
          : new Date();
        const newExpiry = new Date(base);
        newExpiry.setDate(newExpiry.getDate() + 30);

        await storage.updateAgencyByCode(agencyCode, {
          plan,
          subscriptionStatus: "ACTIVE",
          subscriptionExpiry: newExpiry,
          planAssignedAt: new Date(),
        });

        // Save payment record
        try {
          await storage.createPaymentRecord({
            agencyCode,
            razorpayOrderId: payment.order_id || paymentId,
            razorpayPaymentId: paymentId,
            amount,
            currency: payment.currency || "INR",
            plan,
            status: "CAPTURED",
            createdBy: notes.user_id || "webhook",
          });
        } catch (e) {
          console.error("[Subscription Webhook] Payment record save failed:", e);
        }

        // Audit log
        await storage.createAuditLog({
          agencyCode,
          leadId: null,
          userId: "webhook",
          action: "SUBSCRIPTION_ACTIVATED_VIA_PAYMENT",
          oldStatus: agency.subscriptionStatus || "TRIAL",
          newStatus: "ACTIVE",
          remarks: `Plan: ${plan} | Payment ID: ${paymentId} | Expires: ${newExpiry.toDateString()} | Amount: ₹${amount / 100}`,
          targetUserId: null,
        });

        console.log(`[Subscription Webhook] Activated: ${agencyCode} → ${plan} until ${newExpiry.toDateString()}`);
      }

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("[Subscription Webhook] Error:", error);
      return res.status(200).json({ success: true }); // Always 200 to Razorpay
    }
  });

  return httpServer;
}