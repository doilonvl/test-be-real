import { Request, Response } from "express";
import {
  verifyAdminCredentials,
  signAccessToken,
  signRefreshToken,
  verifyRefresh,
} from "../utils/adminAuth";
import rateLimit from "express-rate-limit";
import type { CookieOptions } from "express";

// ================== COOKIE CONFIG ==================
// COOKIE_DOMAIN:
//   - Local dev: thường là "localhost"
//   - Render test + Prod thật: KHÔNG CẦN set (để undefined)
//   - Sau này nếu muốn cookie dùng chung cho *.hasakeplay.com.vn
//     => set COOKIE_DOMAIN=hasakeplay.com.vn rồi mở phần comment trong getBaseCookieOptions
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;

const COOKIE_SECURE =
  String(process.env.COOKIE_SECURE || "false").toLowerCase() === "true";

const IS_PROD = process.env.NODE_ENV === "production";

function getBaseCookieOptions(path: string): CookieOptions {
  const base: CookieOptions = {
    httpOnly: true,
    path,
    secure: IS_PROD ? true : COOKIE_SECURE,
    sameSite: IS_PROD ? "none" : "lax",
  };

  if (!IS_PROD && COOKIE_DOMAIN) {
    base.domain = COOKIE_DOMAIN;
  }

  // 🔧 SAU NÀY KHI LÊN hasakeplay.com.vn VÀ MUỐN COOKIE DÙNG CHUNG
  // CHO TẤT CẢ SUBDOMAIN (*.hasakeplay.com.vn) THÌ BẬT KHỐI NÀY:
  /*
  if (IS_PROD && COOKIE_DOMAIN) {
    base.domain = COOKIE_DOMAIN; // ví dụ "hasakeplay.com.vn"
  }
  */

  return base;
}

function setAuthCookies(res: Response, access: string, refresh: string) {
  res.cookie("access_token", access, getBaseCookieOptions("/"));

  res.cookie(
    "refresh_token",
    refresh,
    getBaseCookieOptions("/api/v1/auth/refresh")
  );
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

    const normEmail = String(email).toLowerCase();
    const access = signAccessToken(normEmail);
    const refresh = signRefreshToken(normEmail);
    setAuthCookies(res, access, refresh);

    return res.json({
      user: { email: normEmail, role: "admin" },
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

  async me(_req: Request, res: Response) {
    res.json({ ok: true });
  },

  async logout(_req: Request, res: Response) {
    res.clearCookie("access_token", getBaseCookieOptions("/"));
    res.clearCookie(
      "refresh_token",
      getBaseCookieOptions("/api/v1/auth/refresh")
    );
    res.json({ message: "Logged out" });
  },
};
