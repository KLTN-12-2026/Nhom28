import jwt from "jsonwebtoken";
import type { Response } from "express";
import { db, env } from "../config/index.js";
import { hash, token } from "../utils/core.js";
const options = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api",
};
export function cookies(
  res: Response,
  session: { id: string; userId: string },
  refresh: string,
) {
  res.cookie(
    "access",
    jwt.sign({ sid: session.id }, env.JWT_SECRET, {
      subject: session.userId,
      expiresIn: "15m",
    }),
    { ...options, maxAge: 900000 },
  );
  res.cookie("refresh", refresh, { ...options, maxAge: 30 * 86400000 });
}
export async function createSession(res: Response, userId: string) {
  const refresh = jwt.sign({ nonce: token() }, env.JWT_REFRESH_SECRET, {
      subject: userId,
      expiresIn: "30d",
    }),
    csrf = token();
  const s = await db.session.create({
    data: {
      userId,
      csrf,
      refreshHash: hash(refresh),
      expiresAt: new Date(Date.now() + 30 * 86400000),
    },
  });
  cookies(res, s, refresh);
  return csrf;
}
export const safeUser = (u: any) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  avatar: u.avatar,
  active: u.active,
  createdAt: u.createdAt,
  profile: u.profile,
});
export const clearCookies = (res: Response) => {
  res.clearCookie("access", options);
  res.clearCookie("refresh", options);
};
