import { Router } from "express";
import { z } from "zod";
import { db } from "../config/index.js";
import * as v from "../validators/index.js";
import { wrap, ok, AppError, today, addDays } from "../utils/core.js";
import { currentGoal, snapshot, dashboard } from "../services/data.js";
import { estimate, scale } from "../nutrition/engine.js";
export const personal = Router();
personal.get(
  "/users/profile",
  wrap(async (req, res) => {
    const p = await db.profile.findUniqueOrThrow({
      where: { userId: req.user.id },
    });
    ok(res, { ...p, estimate: estimate(p) });
  }),
);
personal.put(
  "/users/profile",
  wrap(async (req, res) => {
    const d = v.profile.parse(req.body);
    const name = z
      .string()
      .trim()
      .min(2)
      .max(100)
      .optional()
      .parse(req.body.name);
    const p = await db.$transaction(async (tx) => {
      if (name)
        await tx.user.update({ where: { id: req.user.id }, data: { name } });
      return tx.profile.update({ where: { userId: req.user.id }, data: d });
    });
    ok(res, { ...p, estimate: estimate(p) });
  }),
);
personal.get(
  "/users/goals",
  wrap(async (req, res) =>
    ok(res, {
      current: await currentGoal(req.user.id),
      history: await db.goal.findMany({
        where: { userId: req.user.id },
        orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
      }),
    }),
  ),
);
personal.put(
  "/users/goals",
  wrap(async (req, res) => {
    const d = v.goal.parse(req.body);
    ok(res, await db.goal.create({ data: { ...d, userId: req.user.id } }));
  }),
);
personal.get(
  "/users/preferences",
  wrap(async (req, res) =>
    ok(res, await db.profile.findUnique({ where: { userId: req.user.id } })),
  ),
);
personal.get(
  "/meal-logs/summary",
  wrap(async (req, res) =>
    ok(
      res,
      await dashboard(
        req.user.id,
        req.query.date ? v.date.parse(req.query.date) : today(),
      ),
    ),
  ),
);
personal.get(
  "/meal-logs",
  wrap(async (req, res) => {
    const date = req.query.date ? v.date.parse(req.query.date) : today();
    ok(
      res,
      await db.diaryEntry.findMany({
        where: { userId: req.user.id, date },
        orderBy: { createdAt: "asc" },
      }),
    );
  }),
);
personal.post(
  "/meal-logs",
  wrap(async (req, res) => {
    const d = v.diary.parse(req.body);
    const s = await snapshot(req.user.id, d);
    res.status(201);
    ok(
      res,
      await db.diaryEntry.create({
        data: {
          ...s,
          userId: req.user.id,
          date: d.date,
          meal: d.meal,
          quantity: d.quantity,
        },
      }),
    );
  }),
);
personal.put(
  "/meal-logs/:id",
  wrap(async (req, res) => {
    const d = z
      .object({
        quantity: z.number().positive().max(5000),
        meal: v.meal,
        date: v.date,
      })
      .parse(req.body);
    const e = await db.diaryEntry.findFirst({
      where: { id: String(req.params.id), userId: req.user.id },
    });
    if (!e) throw new AppError(404, "Không tìm thấy.");
    const n = scale(e.baseSnapshot as any, d.quantity);
    ok(
      res,
      await db.diaryEntry.update({ where: { id: e.id }, data: { ...d, ...n } }),
    );
  }),
);
personal.delete(
  "/meal-logs/:id",
  wrap(async (req, res) => {
    const e = await db.diaryEntry.findFirst({
      where: { id: String(req.params.id), userId: req.user.id },
    });
    if (!e) throw new AppError(404, "Không tìm thấy.");
    await db.$transaction(async (tx) => {
      await tx.diaryEntry.delete({ where: { id: e.id } });
      if (e.planItemId)
        await tx.planItem.updateMany({
          where: { id: e.planItemId, plan: { userId: req.user.id } },
          data: { consumed: false },
        });
    });
    ok(res, { deleted: true });
  }),
);
personal.post(
  "/meal-logs/copy",
  wrap(async (req, res) => {
    const d = z
      .object({ from: v.date, to: v.date, meal: v.meal.optional() })
      .refine((d) => d.from !== d.to, "Chọn ngày khác")
      .parse(req.body);
    const entries = await db.diaryEntry.findMany({
      where: {
        userId: req.user.id,
        date: d.from,
        ...(d.meal ? { meal: d.meal } : {}),
      },
    });
    await db.diaryEntry.createMany({
      data: entries.map(({ id, createdAt, planItemId, ...e }) => ({
        ...e,
        date: d.to,
        baseSnapshot: e.baseSnapshot as any,
      })),
    });
    ok(res, { copied: entries.length });
  }),
);
personal.get(
  "/measurements",
  wrap(async (req, res) =>
    ok(
      res,
      await db.measurement.findMany({
        where: { userId: req.user.id },
        orderBy: { date: "asc" },
      }),
    ),
  ),
);
personal.post(
  "/measurements",
  wrap(async (req, res) => {
    const d = v.measurement.parse(req.body);
    ok(
      res,
      await db.$transaction(async (tx) => {
        const m = await tx.measurement.upsert({
          where: { userId_date: { userId: req.user.id, date: d.date } },
          create: { ...d, userId: req.user.id },
          update: d,
        });
        const latest = await tx.measurement.findFirst({
          where: { userId: req.user.id },
          orderBy: { date: "desc" },
        });
        if (latest)
          await tx.profile.update({
            where: { userId: req.user.id },
            data: { weight: latest.weight, height: latest.height },
          });
        return m;
      }),
    );
  }),
);
personal.delete(
  "/measurements/:id",
  wrap(async (req, res) => {
    await db.$transaction(async (tx) => {
      await tx.measurement.deleteMany({
        where: { id: String(req.params.id), userId: req.user.id },
      });
      const latest = await tx.measurement.findFirst({
        where: { userId: req.user.id },
        orderBy: { date: "desc" },
      });
      if (latest)
        await tx.profile.update({
          where: { userId: req.user.id },
          data: { weight: latest.weight, height: latest.height },
        });
    });
    ok(res, { deleted: true });
  }),
);
for (const route of ["dashboard", "calories", "macros", "weight", "progress"])
  personal.get(
    "/analytics/" + route,
    wrap(async (req, res) =>
      ok(
        res,
        await dashboard(
          req.user.id,
          req.query.date ? v.date.parse(req.query.date) : today(),
          Math.min(366, Math.max(7, Number(req.query.days) || 7)),
        ),
      ),
    ),
  );
personal.get(
  "/notifications",
  wrap(async (req, res) =>
    ok(
      res,
      await db.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ),
  ),
);
personal.put(
  "/notifications/:id",
  wrap(async (req, res) => {
    await db.notification.updateMany({
      where: { id: String(req.params.id), userId: req.user.id },
      data: { read: true },
    });
    ok(res, { read: true });
  }),
);
personal.get(
  "/articles",
  wrap(async (req, res) =>
    ok(
      res,
      await db.article.findMany({
        where: {
          published: true,
          ...(req.query.q
            ? { title: { contains: String(req.query.q).slice(0, 100) } }
            : {}),
        },
        orderBy: { createdAt: "desc" },
      }),
    ),
  ),
);
personal.get(
  "/articles/:id",
  wrap(async (req, res) => {
    const a = await db.article.findFirst({
      where: { id: String(req.params.id), published: true },
    });
    if (!a) throw new AppError(404, "Không tìm thấy bài viết.");
    ok(res, a);
  }),
);
personal.get(
  "/feedback",
  wrap(async (req, res) =>
    ok(
      res,
      await db.feedback.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: "desc" },
      }),
    ),
  ),
);
personal.post(
  "/feedback",
  wrap(async (req, res) => {
    const d = z
      .object({
        subject: z.string().min(3).max(150),
        message: z.string().min(10).max(5000),
      })
      .parse(req.body);
    ok(res, await db.feedback.create({ data: { ...d, userId: req.user.id } }));
  }),
);
