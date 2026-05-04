import jwt from "jsonwebtoken";
import { config } from "../config.js";

export type JwtPayload = { sub: string; role: "client" | "instructor" };

export function signToken(payload: JwtPayload): string {
  const expiresIn = config.jwtExpires as jwt.SignOptions["expiresIn"];
  const opts: jwt.SignOptions = { expiresIn };
  return jwt.sign(payload, config.jwtSecret, opts);
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
  return decoded;
}
