import { Request, Response } from "express";
import {
  verifyAdminCredentials,
  signAccessToken,
  signRefreshToken,
  verifyRefresh,
} from "../utils/adminAuth";
import rateLimit from "express-rate-limit";

const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || "localhost";
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || "false") === "true";

function setAuthCookies(res: Response, access: string, refresh: string) {
  // Access cookie: ngắn hạn
  res.cookie("access_token", access, {
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    domain: COOKIE_DOMAIN,
    path: "/",
  });
  // Refresh cookie: dài hạn hơn
  res.cookie("refresh_token", refresh, {
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    domain: COOKIE_DOMAIN,
    path: "/api/v1/auth/refresh",
  });
}

export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

export const authController = {
  async login(req: Request, res: Response) {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email & password are required" });
    }
    const ok = await verifyAdminCredentials(String(email), String(password));
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const access = signAccessToken(String(email).toLowerCase());
    const refresh = signRefreshToken(String(email).toLowerCase());
    setAuthCookies(res, access, refresh);

    return res.json({
      user: { email: String(email).toLowerCase(), role: "admin" },
      token: access,
      expiresIn: process.env.JWT_EXPIRES || "15m",
    });
  },

  async refresh(req: Request, res: Response) {
    const rt = req.cookies?.refresh_token || "";
    if (!rt) return res.status(401).json({ message: "No refresh token" });
    try {
      const payload = verifyRefresh(rt);
      if (typeof payload === "string" || !payload.email) {
        return res.status(401).json({ message: "Invalid refresh token" });
      }
      const access = signAccessToken(payload.email);
      const refresh = signRefreshToken(payload.email);
      setAuthCookies(res, access, refresh);
      return res.json({
        token: access,
        expiresIn: process.env.JWT_EXPIRES || "15m",
      });
    } catch {
      return res.status(401).json({ message: "Invalid refresh token" });
    }
  },

  async me(req: Request, res: Response) {
    res.json({ ok: true });
  },

  async logout(_req: Request, res: Response) {
    res.clearCookie("access_token", { domain: COOKIE_DOMAIN, path: "/" });
    res.clearCookie("refresh_token", {
      domain: COOKIE_DOMAIN,
      path: "/api/v1/auth/refresh",
    });
    res.json({ message: "Logged out" });
  },
};
