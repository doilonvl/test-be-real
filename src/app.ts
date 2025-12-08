import express from "express";
import cors from "cors";
import morgan from "morgan";
import productRoutes from "./routes/productNode.routes";
import uploadRoutes from "./routes/upload.routes";
import contactRoutes from "./routes/contact.routes";
import projectRoutes from "./routes/project.routes";
import catalogRoutes from "./routes/catalog.routes";
import newsRoutes from "./routes/news.routes";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes";
import helmet from "helmet";
import { authAdmin } from "./middlewares/authAdmin";
import crypto from "node:crypto";

const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE_SECURE =
  String(process.env.COOKIE_SECURE || "false").toLowerCase() === "true";
const COOKIE_DOMAIN =
  process.env.COOKIE_DOMAIN && process.env.COOKIE_DOMAIN.trim().length > 0
    ? process.env.COOKIE_DOMAIN.trim()
    : undefined;

const app = express();
// Trust first proxy (e.g., Nginx/Ingress) so secure cookies work behind TLS termination
app.set("trust proxy", 1);

const parsedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const inferredProdOrigins = [
  process.env.FRONTEND_ORIGIN,
  process.env.FRONTEND_URL,
  process.env.APP_URL,
  process.env.RENDER_EXTERNAL_URL,
]
  .map((s) => (s || "").trim())
  .filter(Boolean);

const fallbackDevOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

const allowList =
  parsedOrigins.length > 0
    ? parsedOrigins
    : inferredProdOrigins.length > 0
    ? Array.from(new Set(inferredProdOrigins))
    : Array.from(new Set(fallbackDevOrigins));

if (IS_PROD && allowList.length === 0) {
  throw new Error(
    "CORS_ORIGINS is required in production (comma-separated list, no spaces)."
  );
}

if (!IS_PROD) {
  if (parsedOrigins.length === 0) {
    console.warn(
      "CORS_ORIGINS not set; using fallback dev origins (localhost:3000, 5173). Configure CORS_ORIGINS for production."
    );
  }
} else if (parsedOrigins.length === 0 && inferredProdOrigins.length > 0) {
  console.warn(
    `CORS_ORIGINS not set; using inferred origins: ${inferredProdOrigins.join(
      ", "
    )}`
  );
}

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowList.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-CSRF-Token",
      "X-Requested-With",
    ],
    optionsSuccessStatus: 200,
    maxAge: 86400, // cache preflight for 1 day
  })
);

app.use(helmet());
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: ["text/*"] }));
app.use(morgan("dev"));

// Issue CSRF cookie from API domain if missing, then enforce double-submit:
// - Accept when header and cookie match.
// - If cookie missing but header present, set cookie from header and accept (to avoid mismatch on first write).
// - Safe methods + preflight are skipped.
const CSRF_HEADER = "x-csrf-token";
const CSRF_COOKIE = "csrf_token";
app.use((req, res, next) => {
  // Always ensure we have a CSRF cookie for subsequent requests
  if (!req.cookies?.[CSRF_COOKIE]) {
    const token = crypto.randomBytes(32).toString("hex");
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // FE needs to read to set header
      sameSite: IS_PROD ? "none" : "lax",
      secure: IS_PROD ? true : COOKIE_SECURE,
      path: "/",
      domain: COOKIE_DOMAIN,
    });
    (req as any).cookies = { ...(req as any).cookies, [CSRF_COOKIE]: token };
  }

  // CSRF validation for write methods
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS")
    return next();

  const headerToken = req.get(CSRF_HEADER);
  const cookieToken = req.cookies?.[CSRF_COOKIE];

  // If no cookie but header provided, sync cookie to header to allow first write after FE sets header
  if (!cookieToken && headerToken) {
    res.cookie(CSRF_COOKIE, headerToken, {
      httpOnly: false,
      sameSite: IS_PROD ? "none" : "lax",
      secure: IS_PROD ? true : COOKIE_SECURE,
      path: "/",
      domain: COOKIE_DOMAIN,
    });
    return next();
  }

  if (headerToken && cookieToken && headerToken === cookieToken) {
    return next();
  }

  return res.status(403).json({ message: "CSRF token invalid or missing" });
});

app.get("/healthz", (_req, res) => res.json({ ok: true }));

const API_BASE = process.env.API_BASE?.trim() || "/api/v1";
app.use(`${API_BASE}/products`, productRoutes);
app.use(`${API_BASE}/upload`, uploadRoutes);
app.use(`${API_BASE}/contacts`, contactRoutes);
app.use(`${API_BASE}/projects`, projectRoutes);
app.use(`${API_BASE}/catalogs`, catalogRoutes);
app.use(`${API_BASE}/news`, newsRoutes);
app.use(`${API_BASE}/auth`, authRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});
app.get("/debug/auth-config", authAdmin, (_req, res) => {
  const hash = process.env.ADMIN_PASSWORD_HASH || "";
  res.json({
    adminEmail: (process.env.ADMIN_EMAIL || "").trim(),
    hashLooksBcrypt: /^\$2[aby]\$\d{2}\$/.test(hash),
    hashLen: hash.length,
  });
});

app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ message: err?.message || "Internal Server Error" });
  }
);

export default app;
