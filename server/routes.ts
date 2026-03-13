import type { Express, Request, Response, NextFunction } from "express";
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
import { openai, speechToText, ensureCompatibleFormat } from "./replit_integrations/audio/client";
import { sendWelcomeEmail, sendProspectEmail, sendPasswordResetEmail, sendPlanUpgradeEmail } from "./email";

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
// Multer with file type validation
const ALLOWED_AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/mp4", "audio/ogg", "audio/webm", "audio/m4a", "video/mp4"];
const ALLOWED_SHEET_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
];

const upload = multer({
  dest: "/tmp/uploads/",
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [...ALLOWED_AUDIO_TYPES, ...ALLOWED_SHEET_TYPES];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error(`Invalid file type: ${file.mimetype}`));
  },
});

// AI Proceeding monthly transcription limits per plan
const AI_PROCEEDING_LIMITS: Record<string, number> = {
  BASIC: 0,        // No AI access
  PRO: 10,         // 10 transcriptions per month
  ENTERPRISE: Infinity, // Unlimited
};

// RC Lookup monthly limits per plan
const RC_LOOKUP_LIMITS: Record<string, number> = {
  BASIC: 0,        // No RC access
  PRO: 50,         // 50 lookups per month
  ENTERPRISE: Infinity, // Unlimited
};

function generateToken(user: User): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, agencyCode: user.agencyCode },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

interface AuthRequest extends Request {
  user?: { id: string; username: string; role: string; agencyCode: string | null };
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ success: false, message: "Authentication required" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
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

      const token = generateToken(user);
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

      // Send welcome email to newly approved user
      try {
        const approvedUser = await storage.getUser(req.params.id);
        if (approvedUser && approvedUser.email) {
          const finalAgencyCode = approvedUser.agencyCode || updateData.agencyCode;
          if (finalAgencyCode) {
            const agency = await storage.getAgencyByCode(finalAgencyCode);
            if (agency) {
              sendWelcomeEmail(
                approvedUser.email,
                approvedUser.fullName,
                approvedUser.username,
                agency.plan,
                agency.name
              ).catch((err) => console.error("Welcome email failed:", err.message));
            }
          }
        }
      } catch (emailErr) {
        console.error("Welcome email error:", emailErr);
      }

      // ── Send welcome email on approval ───────────────────────────────────
      try {
        const freshUser = await storage.getUser(req.params.id);
        const finalAgencyCode = freshUser?.agencyCode || updateData.agencyCode;
        if (freshUser?.email && finalAgencyCode) {
          const agency = await storage.getAgencyByCode(finalAgencyCode);
          if (agency) {
            sendWelcomeEmail(
              freshUser.email,
              freshUser.fullName,
              freshUser.username,
              agency.plan,
              agency.name
            ).catch(err => console.error("Welcome email failed (non-blocking):", err.message));
          }
        }
      } catch (emailErr: any) {
        console.error("Welcome email error:", emailErr.message);
      }

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
      const allAgencies = await storage.getAllAgencies();
      res.json({ success: true, data: allAgencies });
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
      const user = await storage.createUser({
        username, password: hashedPassword, fullName, email, mobile: mobile || null,
        role, agencyCode, isActive: true, status: "ACTIVE"
      });
      const { password: _, ...safeUser } = user;

      // Send welcome email if email provided and agency exists
      if (email && agencyCode && role === "AGENCY_ADMIN") {
        const agency = await storage.getAgencyByCode(agencyCode);
        if (agency) {
          sendWelcomeEmail(email, fullName, username, agency.plan, agency.name).catch(err =>
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
        const userList = await storage.getTelecallersByAgency(agencyCode);
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
      const result = await storage.getLeadsByAgency(agencyCode, page, limit, status, assignment, search);
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

      if (req.body.status === "FOLLOW_UP" && !req.body.followUpDate) {
        return res.status(400).json({ success: false, message: "Follow-up date is required" });
      }

      const updateData = { ...req.body };
      if (updateData.followUpDate) {
        updateData.followUpDate = new Date(updateData.followUpDate);
      }

      const oldStatus = lead.status;
      const updated = await storage.updateLead(req.params.id, updateData);

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
          await storage.updateLead(leadId, { assignedTo, service: service || lead.service });
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
      const service = await storage.createService({ agencyCode, name });
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
      const wb = XLSX.utils.book_new();
      const data = allLeads.map(l => ({
        Name: l.name, Phone: l.phone, Email: l.email || "",
        Source: l.source || "", Service: l.service || "", Status: l.status,
        "Follow-Up Date": l.followUpDate ? new Date(l.followUpDate).toLocaleDateString() : "",
        Remarks: l.remarks || "",
        "Created At": l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "",
      }));
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
            const { buffer: compatibleBuffer, format } = await ensureCompatibleFormat(audioBuffer);
            transcript = await speechToText(compatibleBuffer, format, audioLanguage);
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
                    content: `You are an expert meeting analyst and multilingual transcription assistant for an insurance CRM.

You will receive a raw Whisper transcript. Your tasks:
1. Clean & format with speaker labels
2. Extract structured business insights

TRANSCRIPTION RULES:
- Identify distinct speakers from conversation flow (questions vs answers, tone changes)
- Label as "Speaker 1:", "Speaker 2:" etc — or use actual names/titles if mentioned
- Preserve EXACT original language (Hindi, Marathi, English, Hinglish — do NOT translate)
- If Whisper has repeated sentences, de-duplicate them
- Mark unclear parts as [unclear]
- If only one speaker, use "Speaker 1:"

INSIGHT RULES:
- Extract EXACT numbers, rates, quantities — never fabricate
- Empty array [] if section has no data
- sentiment: "Positive", "Neutral", "Concerned", or "Critical"

Return ONLY valid JSON (no markdown, no explanation):
{
  "diarizedTranscript": "Speaker 1: text...\nSpeaker 2: text...",
  "summary": "5-8 sentence summary of purpose, discussions, decisions, outcomes",
  "targets": ["target with numbers"],
  "achievements": ["achievement with data"],
  "responsiblePersons": ["Name - role/responsibility"],
  "kpis": ["Metric - exact value"],
  "deadlines": ["Task - timeline"],
  "riskPoints": ["risk or concern"],
  "actionItems": ["action - owner"],
  "keyDecisions": ["decision made"],
  "nextSteps": ["next step"],
  "clientMentions": ["Name/Company - context"],
  "keyFigures": ["Description - exact value"],
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

      // ── Speaker Diarization via GPT Smart Split ──────────────────────────────
      // Uses GPT-4o-mini to identify and label speakers from conversation flow
      let diarizedTranscript = transcript;
      try {
        const diarizeResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are an expert at analyzing conversation transcripts and identifying different speakers.

Your task is to split the transcript into labeled speaker turns. Follow these rules:
1. Identify distinct speakers based on conversation flow, topics, questions vs answers, and tone
2. Label speakers as "Speaker 1:", "Speaker 2:", etc. — or use actual names/titles if clearly mentioned (e.g. "Sir Ji:", "Haji:")
3. Each speaker turn should be on a new line starting with the speaker label
4. Preserve the original language (Hindi/English/Hinglish) exactly as spoken
5. Do NOT translate or modify the content — only add speaker labels
6. Group consecutive sentences from the same speaker together
7. If the transcript is already short or has only one speaker, return it as "Speaker 1: [full text]"

Return ONLY the formatted transcript with speaker labels. No explanation, no markdown.`
            },
            {
              role: "user",
              content: `Split this transcript by speaker:

${transcript}`
            }
          ],
          temperature: 0.1,
          max_tokens: 3000,
        });
        const diarized = diarizeResponse.choices[0]?.message?.content?.trim();
        if (diarized && diarized.length > 0) {
          diarizedTranscript = diarized;
        }
      } catch (err: any) {
        console.error("Speaker diarization error:", err.message);
        // Fall back to original transcript if diarization fails
        diarizedTranscript = transcript;
      }

      let aiInsights: any = {};
      try {
        const gptResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a senior AI meeting analyst for an insurance CRM system. Analyze the meeting transcript thoroughly and extract detailed, actionable insights. Be specific — include names, numbers, dates, and context wherever possible. Return a JSON object with these fields:
- summary: A detailed 4-6 sentence executive summary covering the meeting's purpose, key outcomes, and overall direction
- targets: Array of specific targets/goals discussed (include numbers, percentages, timelines where mentioned)
- achievements: Array of achievements, milestones reached, or progress made (be specific with data)
- responsiblePersons: Array of people mentioned with their responsibilities (format: "Name - Role/Responsibility")
- kpis: Array of KPIs, metrics, or performance indicators discussed (include actual values if mentioned)
- deadlines: Array of deadlines, timelines, or due dates (format: "Task/Item - Date/Timeline")
- riskPoints: Array of risks, concerns, blockers, or challenges raised (include severity if apparent)
- actionItems: Array of specific action items or tasks assigned (format: "Action - Owner (if mentioned)")
- keyDecisions: Array of important decisions made during the meeting
- nextSteps: Array of agreed next steps or follow-up actions
- clientMentions: Array of client/customer names or accounts mentioned with context
- keyFigures: Array of important numbers, amounts, percentages, or statistics mentioned (format: "Description - Value")
- sentiment: Overall meeting sentiment in one word: "Positive", "Neutral", "Concerned", or "Critical"
Return ONLY valid JSON, no markdown.`
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

  // GET /api/rc-records — get saved RC lookups for this agency
  app.get("/api/rc-records", authMiddleware, roleMiddleware("AGENCY_ADMIN", "TEAM_LEADER"), async (req: AuthRequest, res: Response) => {
    try {
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

  // ── Email API Endpoints ────────────────────────────────────────────────────

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
      const sent = await sendWelcomeEmail(to, fullName, username, agency.plan, agency.name);
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

  return httpServer;
}