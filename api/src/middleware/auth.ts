import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.js";

export type AuthedRequest = Request & { userId?: string; userRole?: "client" | "instructor" };

export function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  const token = h?.startsWith("Bearer ") ? h.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const p = verifyToken(token);
    req.userId = p.sub;
    req.userRole = p.role;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(role: "client" | "instructor") {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (req.userRole !== role) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
