import { Router } from "express";
import { z } from "zod";
import { db } from "../config/index.js";
import { wrap, ok, AppError, today } from "../utils/core.js";
import { date } from "../validators/index.js";
export const hydration = Router();
hydration.get(
  "/hydration",
  wrap(async (req, res) => {
    const selected = req.query.date ? date.parse(req.query.date) : today();
    const [entries, p] = await Promise.all([
      db.hydrationLog.findMany({
        where: { userId: req.user.id, date: selected },
        orderBy: { createdAt: "desc" },
      }),
      db.profile.findUniqueOrThrow({ where: { userId: req.user.id } }),
    ]);
    ok(res, {
      date: selected,
      entries,
      totalMl: entries.reduce((s, e) => s + e.amountMl, 0),
      goalMl: p.waterGoalMl,
    });
  }),
);
hydration.post(
  "/hydration",
  wrap(async (req, res) => {
    const input = z
      .object({ date, amountMl: z.number().int().min(50).max(1000) })
      .parse(req.body);
    const entry = await db.$transaction(async (tx) => {
      await tx.profile.update({
        where: { userId: req.user.id },
        data: { updatedAt: new Date() },
      });
      const existing = await tx.hydrationLog.aggregate({
        where: { userId: req.user.id, date: input.date },
        _sum: { amountMl: true },
      });
      if ((existing._sum.amountMl || 0) + input.amountMl > 10000)
        throw new AppError(
          422,
          "Tổng lượng nước ghi nhận trong ngày vượt giới hạn dữ liệu. Hãy kiểm tra lại số lượng.",
        );
      return tx.hydrationLog.create({
        data: { ...input, userId: req.user.id },
      });
    });
    res.status(201);
    ok(res, entry);
  }),
);
hydration.put(
  "/hydration/goal",
  wrap(async (req, res) => {
    const { goalMl } = z
      .object({ goalMl: z.number().int().min(250).max(8000) })
      .parse(req.body);
    await db.profile.update({
      where: { userId: req.user.id },
      data: { waterGoalMl: goalMl },
    });
    ok(res, { goalMl });
  }),
);
hydration.delete(
  "/hydration/:id",
  wrap(async (req, res) => {
    const result = await db.hydrationLog.deleteMany({
      where: { id: String(req.params.id), userId: req.user.id },
    });
    if (!result.count) throw new AppError(404, "Không tìm thấy lần ghi nhận.");
    ok(res, { deleted: true });
  }),
);
