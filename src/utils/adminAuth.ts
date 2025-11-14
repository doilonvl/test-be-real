import * as jwt from "jsonwebtoken";
import type { SignOptions, Secret } from "jsonwebtoken";
import bcrypt from "bcryptjs";

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
}

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD_HASH = (process.env.ADMIN_PASSWORD_HASH || "").trim();

const JWT_SECRET: Secret = requireEnv("JWT_SECRET");
const REFRESH_SECRET: Secret = requireEnv("REFRESH_SECRET");
const ACCESS_EXPIRES_IN = (process.env.JWT_EXPIRES ||
  "15m") as SignOptions["expiresIn"];
const REFRESH_EXPIRES_IN = (process.env.REFRESH_EXPIRES ||
  "7d") as SignOptions["expiresIn"];

export async function verifyAdminCredentials(email: string, password: string) {
  if (!email || !password) return false;

  if (email.trim().toLowerCase() !== ADMIN_EMAIL) return false;
  if (!ADMIN_PASSWORD_HASH) return false;

  try {
    return await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  } catch (e) {
    console.error("bcrypt compare failed:", e);
    return false;
  }
}

export function signAccessToken(email: string) {
  return jwt.sign({ sub: "admin", role: "admin", email }, JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN,
  });
}

export function signRefreshToken(email: string) {
  return jwt.sign({ sub: "admin", type: "refresh", email }, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN,
  });
}

export function verifyAccess(token: string) {
  return jwt.verify(token, JWT_SECRET);
}

export function verifyRefresh(token: string) {
  return jwt.verify(token, REFRESH_SECRET);
}
