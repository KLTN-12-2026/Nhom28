import type { Request, Response, NextFunction } from "express";
import { randomBytes, createHash } from "node:crypto";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const assert = (
  value: unknown,
  status = 404,
  message = "Không tìm thấy dữ liệu.",
): asserts value => {
  if (!value) throw new AppError(status, message);
};
export const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
export const ok = (res: Response, data: unknown, meta?: unknown) =>
  res.json({ success: true, data, ...(meta ? { meta } : {}) });
export const token = () => randomBytes(32).toString("hex");
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const addDays = (date: string, days: number) =>
  new Date(new Date(`${date}T12:00:00Z`).getTime() + days * 86400000)
    .toISOString()
    .slice(0, 10);
export const page = (q: Record<string, unknown>) => {
  const take = Math.max(1, Math.min(100, Number(q.limit) || 24));
  const p = Math.max(1, Number(q.page) || 1);
  return { take, skip: (p - 1) * take, page: p };
};
