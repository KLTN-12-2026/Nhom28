import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, env } from "../config/index.js";
import { AppError, wrap } from "../utils/core.js";
declare global {
  namespace Express {
    interface Request {
      user: { id: string; role: string; name: string; email: string };
      sessionId: string;
    }
  }
}
export const auth = wrap(async (req, res, next) => {
  let payload: any;
  try {
    payload = jwt.verify(req.cookies.access || "", env.JWT_SECRET);
  } catch {
    throw new AppError(401, "Phiên đăng nhập đã hết hạn.");
  }
  const session = await db.session.findUnique({
    where: { id: payload.sid },
    include: { user: true },
  });
  if (
    !session ||
    session.userId !== payload.sub ||
    session.expiresAt < new Date() ||
    !session.user.active
  )
    throw new AppError(401, "Phiên đăng nhập không hợp lệ.");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.header("x-csrf-token") !== session.csrf
  )
    throw new AppError(
      403,
      "Yêu cầu bảo mật không hợp lệ. Vui lòng tải lại trang.",
    );
  req.user = {
    id: session.userId,
    role: session.user.role,
    name: session.user.name,
    email: session.user.email,
  };
  req.sessionId = session.id;
  next();
});
export const admin = (req: Request, _: Response, next: NextFunction) =>
  req.user.role === "ADMIN"
    ? next()
    : next(new AppError(403, "Chỉ quản trị viên được thực hiện thao tác này."));
