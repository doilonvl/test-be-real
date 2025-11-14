import { Request, Response, NextFunction } from "express";
import { verifyAccess } from "../utils/adminAuth";

export function authAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.access_token
    || (req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "");

  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const payload = verifyAccess(token);
    if (typeof payload === "string" || payload?.role !== "admin") throw new Error("Invalid role");
    (req as any).isAdmin = true;
    (req as any).adminEmail = payload.email;
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}
