import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import nodemailer from "nodemailer";
import { rateLimit } from "express-rate-limit";
import { db, env, allowedOrigins } from "../config/index.js";
import { auth } from "../middlewares/auth.js";
import {
  createSession,
  cookies,
  safeUser,
  clearCookies,
} from "../services/auth.js";
import { wrap, ok, AppError, hash, token } from "../utils/core.js";
import { password } from "../validators/index.js";
export const authRouter = Router();
const limit = rateLimit({
  windowMs: 15 * 60000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, error: "Thử lại sau ít phút." },
});
authRouter.post(
  "/register",
  limit,
  wrap(async (req, res) => {
    const data = z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z
          .string()
          .email()
          .max(190)
          .transform((s) => s.toLowerCase()),
        password,
      })
      .parse(req.body);
    if (await db.user.findUnique({ where: { email: data.email } }))
      throw new AppError(409, "Email đã được sử dụng.");
    const u = await db.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: await bcrypt.hash(data.password, 12),
        profile: { create: { allergens: [] } },
        notifications: {
          create: {
            title: "Chào mừng đến NutriAI",
            body: "Hoàn tất hồ sơ để nhận gợi ý phù hợp với bạn.",
          },
        },
      },
      include: { profile: true },
    });
    const csrf = await createSession(res, u.id);
    res.status(201);
    ok(res, { user: safeUser(u), csrf });
  }),
);
authRouter.post(
  "/login",
  limit,
  wrap(async (req, res) => {
    const d = z
      .object({
        email: z
          .string()
          .email()
          .transform((s) => s.toLowerCase()),
        password: z.string().max(100),
      })
      .parse(req.body);
    const u = await db.user.findUnique({
      where: { email: d.email },
      include: { profile: true },
    });
    if (!u || !u.active || !(await bcrypt.compare(d.password, u.passwordHash)))
      throw new AppError(
        401,
        "Email hoặc mật khẩu không đúng, hoặc tài khoản bị khóa.",
      );
    const csrf = await createSession(res, u.id);
    ok(res, { user: safeUser(u), csrf });
  }),
);
authRouter.post(
  "/refresh",
  limit,
  wrap(async (req, res) => {
    if (!allowedOrigins.includes(req.header("origin") || ""))
      throw new AppError(403, "Nguồn yêu cầu không hợp lệ.");
    const value = req.cookies.refresh || "";
    try {
      jwt.verify(value, env.JWT_REFRESH_SECRET);
    } catch {
      throw new AppError(401, "Vui lòng đăng nhập lại.");
    }
    const s = await db.session.findUnique({
      where: { refreshHash: hash(value) },
      include: { user: { include: { profile: true } } },
    });
    if (!s || s.expiresAt < new Date() || !s.user.active)
      throw new AppError(401, "Vui lòng đăng nhập lại.");
    const nextRefresh = jwt.sign({ nonce: token() }, env.JWT_REFRESH_SECRET, {
      subject: s.userId,
      expiresIn: "30d",
    });
    const updated = await db.session.updateMany({
      where: { id: s.id, refreshHash: hash(value) },
      data: { refreshHash: hash(nextRefresh) },
    });
    if (updated.count !== 1) throw new AppError(401, "Phiên đã được làm mới.");
    cookies(res, s, nextRefresh);
    ok(res, { csrf: s.csrf, user: safeUser(s.user) });
  }),
);
authRouter.get(
  "/me",
  auth,
  wrap(async (req, res) => {
    const u = await db.user.findUniqueOrThrow({
      where: { id: req.user.id },
      include: { profile: true },
    });
    const s = await db.session.findUniqueOrThrow({
      where: { id: req.sessionId },
    });
    ok(res, { user: safeUser(u), csrf: s.csrf });
  }),
);
authRouter.post(
  "/logout",
  auth,
  wrap(async (req, res) => {
    await db.session.deleteMany({ where: { id: req.sessionId } });
    clearCookies(res);
    ok(res, { message: "Đã đăng xuất." });
  }),
);
authRouter.post(
  "/forgot-password",
  limit,
  wrap(async (req, res) => {
    const { email } = z
      .object({
        email: z
          .string()
          .email()
          .transform((s) => s.toLowerCase()),
      })
      .parse(req.body);
    const u = await db.user.findUnique({ where: { email } });
    let developmentResetUrl: string | undefined;
    if (u) {
      const raw = token();
      await db.passwordReset.create({
        data: {
          userId: u.id,
          tokenHash: hash(raw),
          expiresAt: new Date(Date.now() + 30 * 60000),
        },
      });
      const link = `${env.FRONTEND_URL}/reset-password?token=${raw}`;
      if (process.env.SMTP_HOST) {
        await nodemailer
          .createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_PORT === "465",
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD,
            },
          })
          .sendMail({
            from: process.env.SMTP_FROM,
            to: email,
            subject: "Đặt lại mật khẩu NutriAI",
            text: `Liên kết có hiệu lực 30 phút: ${link}`,
          });
      } else if (env.NODE_ENV === "development") developmentResetUrl = link;
    }
    ok(res, {
      message: "Nếu email tồn tại, bạn sẽ nhận hướng dẫn đặt lại mật khẩu.",
      developmentResetUrl,
    });
  }),
);
authRouter.post(
  "/reset-password",
  limit,
  wrap(async (req, res) => {
    const d = z
      .object({ token: z.string().length(64), password })
      .parse(req.body);
    const t = await db.passwordReset.findUnique({
      where: { tokenHash: hash(d.token) },
    });
    if (!t || t.expiresAt < new Date())
      throw new AppError(400, "Liên kết không hợp lệ hoặc đã hết hạn.");
    const ph = await bcrypt.hash(d.password, 12);
    await db.$transaction(async (tx) => {
      const used = await tx.passwordReset.deleteMany({
        where: { id: t.id, expiresAt: { gt: new Date() } },
      });
      if (used.count !== 1) throw new AppError(400, "Liên kết đã dùng.");
      await tx.user.update({
        where: { id: t.userId },
        data: { passwordHash: ph },
      });
      await tx.passwordReset.deleteMany({ where: { userId: t.userId } });
      await tx.session.deleteMany({ where: { userId: t.userId } });
    });
    clearCookies(res);
    ok(res, { message: "Đã cập nhật mật khẩu. Hãy đăng nhập lại." });
  }),
);
authRouter.post(
  "/change-password",
  auth,
  limit,
  wrap(async (req, res) => {
    const d = z
      .object({ currentPassword: z.string().max(100), password })
      .parse(req.body);
    const u = await db.user.findUniqueOrThrow({ where: { id: req.user.id } });
    if (!(await bcrypt.compare(d.currentPassword, u.passwordHash)))
      throw new AppError(400, "Mật khẩu hiện tại không đúng.");
    await db.$transaction([
      db.user.update({
        where: { id: u.id },
        data: { passwordHash: await bcrypt.hash(d.password, 12) },
      }),
      db.session.deleteMany({ where: { userId: u.id } }),
    ]);
    clearCookies(res);
    ok(res, { message: "Đã đổi mật khẩu. Vui lòng đăng nhập lại." });
  }),
);
authRouter.get(
  "/sessions",
  auth,
  wrap(async (req, res) =>
    ok(
      res,
      await db.session.findMany({
        where: { userId: req.user.id },
        select: { id: true, createdAt: true, expiresAt: true },
      }),
    ),
  ),
);
authRouter.delete(
  "/sessions/:id",
  auth,
  wrap(async (req, res) => {
    await db.session.deleteMany({
      where: { id: String(req.params.id), userId: req.user.id },
    });
    ok(res, { deleted: true });
  }),
);
