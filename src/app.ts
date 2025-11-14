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

const app = express();

const allowList = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowList.length === 0 || allowList.includes(origin))
        return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(helmet());
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: ["text/*"] }));
app.use(morgan("dev"));

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
app.get("/debug/auth-config", (_req, res) => {
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
