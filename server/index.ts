import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import jwt from "jsonwebtoken";

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

// ─── Validate required env vars on startup ───────────────────────────────────
const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) throw new Error("SESSION_SECRET environment variable is required");
if (JWT_SECRET.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");

// ─── Security Headers (helmet) ───────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", "blob:"],
        frameSrc: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    frameguard: { action: "deny" },
  })
);

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? (process.env.ALLOWED_ORIGINS || "https://crm.icaweb.in").split(",").map(o => o.trim())
    : ["http://localhost:5000", "http://127.0.0.1:5000"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ─── Body Parsers ────────────────────────────────────────────────────────────
declare module "http" {
  interface IncomingMessage { rawBody: unknown; }
}

app.use(express.json({ limit: "1mb", verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// ─── Rate Limiters ───────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { success: false, message: "Too many login attempts. Please try again after 15 minutes." },
  standardHeaders: true, legacyHeaders: false,
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5,
  message: { success: false, message: "Too many signup attempts. Please try again later." },
  standardHeaders: true, legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 200,
  message: { success: false, message: "Too many requests. Please try again later." },
  standardHeaders: true, legacyHeaders: false,
});

const heavyLimiter = rateLimit({
  windowMs: 60 * 1000, max: 10,
  message: { success: false, message: "Too many upload/processing requests. Please wait a moment." },
  standardHeaders: true, legacyHeaders: false,
});

app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/signup", signupLimiter);
app.use("/api/leads/upload", heavyLimiter);
app.use("/api/meetings", heavyLimiter);
app.use("/api/", apiLimiter);

// ─── Auth guard for Replit integration routes ─────────────────────────────────
const jwtGuard = (req: any, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ success: false, message: "Authentication required" });
  try { jwt.verify(token, JWT_SECRET!); next(); }
  catch { return res.status(401).json({ success: false, message: "Invalid or expired token" }); }
};
app.use("/api/conversations", jwtGuard);
app.use("/api/generate-image", jwtGuard);

// ─── Structured Request Logger ────────────────────────────────────────────────
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const safe = { ...capturedJsonResponse };
        delete safe.token; delete safe.password;
        const responseStr = JSON.stringify(safe);
        logLine += ` :: ${responseStr.length > 200 ? responseStr.substring(0, 200) + "..." : responseStr}`;
      }
      log(logLine);
    }
  });
  next();
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────
(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    const message =
      process.env.NODE_ENV === "production" && status >= 500
        ? "Internal server error"
        : err.message || "An error occurred";
    return res.status(status).json({ success: false, message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, "127.0.0.1", async () => {
    log(`serving on port ${port}`);
    // Auto-seed only in development
    if (process.env.NODE_ENV !== "production") {
      try {
        const seedRes = await fetch(`http://127.0.0.1:${port}/api/seed`, { method: "POST" });
        const seedData = await seedRes.json();
        log(`Seed: ${seedData.message}`);
      } catch { log("Seed skipped"); }
    }
  });
})();
