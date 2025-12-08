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

const IS_PROD = process.env.NODE_ENV === "production";

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

// Simple double-submit CSRF: FE must send the same token in cookie and header X-CSRF-Token for write operations
const CSRF_HEADER = "x-csrf-token";
const CSRF_COOKIE = "csrf_token";
app.use((req, res, next) => {
  // Allow safe methods and preflight through
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS")
    return next();

  const headerToken = req.get(CSRF_HEADER);
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return res.status(403).json({ message: "CSRF token invalid or missing" });
  }
  return next();
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
