import { Router } from "express";
import { z } from "zod";
import { db } from "../config/index.js";
import { wrap, ok, AppError, addDays, today } from "../utils/core.js";
import { date, meal } from "../validators/index.js";
import { recipeInclude, visible, currentGoal } from "../services/data.js";
import { decorateRecipe, scale } from "../nutrition/engine.js";
import { candidates } from "../services/recommendation.js";
export const plans = Router();
async function owned(userId: string, id: string) {
  const p = await db.mealPlan.findFirst({
    where: { id, userId },
    include: {
      items: {
        include: { recipe: { include: recipeInclude } },
        orderBy: [{ date: "asc" }, { meal: "asc" }],
      },
    },
  });
  if (!p) throw new AppError(404, "Không tìm thấy thực đơn.");
  return p;
}
plans.get(
  "/meal-plan-templates",
  wrap(async (req, res) =>
    ok(
      res,
      await db.mealPlan.findMany({
        where: { isTemplate: true, published: true },
        select: {
          id: true,
          name: true,
          days: true,
          explanation: true,
          goalSnapshot: true,
          items: { select: { meal: true, servings: true, snapshot: true } },
        },
        take: 50,
      }),
    ),
  ),
);
plans.post(
  "/meal-plan-templates/:id/copy",
  wrap(async (req, res) => {
    const { startDate } = z.object({ startDate: date }).parse(req.body),
      p = await db.mealPlan.findFirst({
        where: { id: String(req.params.id), isTemplate: true, published: true },
        include: { items: true },
      });
    if (!p) throw new AppError(404, "Không tìm thấy mẫu.");
    const { recipes } = await candidates(req.user.id);
    if (p.items.some((i) => !recipes.some((r) => r.id === i.recipeId)))
      throw new AppError(
        422,
        "Mẫu có món không phù hợp với hồ sơ của bạn. Hãy tạo gợi ý riêng để giữ đúng ràng buộc.",
      );
    const copy = await db.mealPlan.create({
      data: {
        userId: req.user.id,
        name: p.name + " (bản sao)",
        startDate,
        days: p.days,
        mode: "manual",
        explanation: p.explanation,
        goalSnapshot: p.goalSnapshot as any,
        items: {
          create: p.items.map((i) => ({
            recipeId: i.recipeId,
            meal: i.meal,
            servings: i.servings,
            snapshot: i.snapshot as any,
            date: addDays(
              startDate,
              Math.round(
                (Date.parse(i.date) - Date.parse(p.startDate)) / 86400000,
              ),
            ),
          })),
        },
      },
    });
    ok(res, copy);
  }),
);
plans.get(
  "/meal-plans",
  wrap(async (req, res) =>
    ok(
      res,
      await db.mealPlan.findMany({
        where: { userId: req.user.id },
        include: { items: { include: { recipe: { include: recipeInclude } } } },
        orderBy: { createdAt: "desc" },
      }),
    ),
  ),
);
plans.get(
  "/meal-plans/:id",
  wrap(async (req, res) =>
    ok(res, await owned(req.user.id, String(req.params.id))),
  ),
);
plans.post(
  "/meal-plans",
  wrap(async (req, res) => {
    const d = z
      .object({
        name: z.string().min(2).max(150),
        startDate: date,
        days: z.number().int().min(1).max(31),
      })
      .parse(req.body);
    const g = await currentGoal(req.user.id, d.startDate);
    ok(
      res,
      await db.mealPlan.create({
        data: {
          ...d,
          userId: req.user.id,
          explanation: "Thực đơn do bạn tự sắp xếp.",
          goalSnapshot: g
            ? {
                calories: g.calories,
                protein: g.protein,
                carbs: g.carbs,
                fat: g.fat,
              }
            : {},
        },
      }),
    );
  }),
);
plans.put(
  "/meal-plans/:id",
  wrap(async (req, res) => {
    const p = await owned(req.user.id, String(req.params.id));
    const d = z.object({ name: z.string().min(2).max(150) }).parse(req.body);
    ok(res, await db.mealPlan.update({ where: { id: p.id }, data: d }));
  }),
);
plans.delete(
  "/meal-plans/:id",
  wrap(async (req, res) => {
    const p = await owned(req.user.id, String(req.params.id));
    await db.$transaction([
      db.shoppingItem.deleteMany({
        where: { planId: p.id, userId: req.user.id },
      }),
      db.mealPlan.delete({ where: { id: p.id } }),
    ]);
    ok(res, { deleted: true });
  }),
);
plans.post(
  "/meal-plans/:id/copy",
  wrap(async (req, res) => {
    const p = await owned(req.user.id, String(req.params.id));
    const d = z
      .object({ startDate: date, onlyDate: date.optional() })
      .parse(req.body);
    const source = d.onlyDate
      ? p.items.filter((i) => i.date === d.onlyDate)
      : p.items;
    ok(
      res,
      await db.mealPlan.create({
        data: {
          userId: req.user.id,
          name: p.name + " (bản sao)",
          days: d.onlyDate ? 1 : p.days,
          startDate: d.startDate,
          explanation: p.explanation,
          goalSnapshot: p.goalSnapshot as any,
          mode: "manual",
          items: {
            create: source.map((i) => ({
              recipeId: i.recipeId,
              date: addDays(
                d.startDate,
                Math.round(
                  (Date.parse(i.date) - Date.parse(d.onlyDate || p.startDate)) /
                    86400000,
                ),
              ),
              meal: i.meal,
              servings: i.servings,
              snapshot: i.snapshot as any,
            })),
          },
        },
      }),
    );
  }),
);
plans.post(
  "/meal-plans/:id/items",
  wrap(async (req, res) => {
    const p = await owned(req.user.id, String(req.params.id)),
      d = z
        .object({
          recipeId: z.string(),
          date,
          meal,
          servings: z.number().min(0.25).max(3),
        })
        .parse(req.body);
    if (d.date < p.startDate || d.date > addDays(p.startDate, p.days - 1))
      throw new AppError(400, "Ngày ngoài thời gian thực đơn.");
    const { recipes } = await candidates(req.user.id, { cookingMinutes: 240 });
    const r = recipes.find((r) => r.id === d.recipeId);
    if (!r)
      throw new AppError(
        422,
        "Món không phù hợp dị ứng hoặc chế độ ăn của bạn.",
      );
    ok(
      res,
      await db.planItem.create({
        data: {
          ...d,
          planId: p.id,
          snapshot: {
            ...scale(r, 1),
            name: r.name,
            image: r.image,
            cost: r.cost,
          },
        },
      }),
    );
  }),
);
plans.get(
  "/meal-plan-items/:id/alternatives",
  wrap(async (req, res) => {
    const i = await db.planItem.findFirst({
      where: { id: String(req.params.id), plan: { userId: req.user.id } },
    });
    if (!i) throw new AppError(404, "Không tìm thấy.");
    const { recipes } = await candidates(req.user.id);
    const c = (i.snapshot as any).calories * i.servings;
    ok(
      res,
      recipes
        .filter((r) => r.id !== i.recipeId)
        .map((r) => ({
          ...r,
          suggestedServings: Math.max(
            0.25,
            Math.min(3, Math.round((c / r.calories) * 20) / 20),
          ),
        }))
        .sort(
          (a, b) =>
            Math.abs(a.calories * a.suggestedServings - c) -
            Math.abs(b.calories * b.suggestedServings - c),
        )
        .slice(0, 5),
    );
  }),
);
plans.put(
  "/meal-plan-items/:id",
  wrap(async (req, res) => {
    const i = await db.planItem.findFirst({
      where: { id: String(req.params.id), plan: { userId: req.user.id } },
      include: { plan: true },
    });
    if (!i) throw new AppError(404, "Không tìm thấy.");
    if (i.consumed)
      throw new AppError(409, "Bữa đã ghi nhật ký. Hãy sửa trong nhật ký.");
    const d = z
      .object({
        recipeId: z.string(),
        servings: z.number().min(0.25).max(3),
        date,
        meal,
      })
      .parse(req.body);
    if (
      d.date < i.plan.startDate ||
      d.date > addDays(i.plan.startDate, i.plan.days - 1)
    )
      throw new AppError(400, "Ngày ngoài thực đơn.");
    const { recipes } = await candidates(req.user.id, { cookingMinutes: 240 });
    const r = recipes.find((r) => r.id === d.recipeId);
    if (!r) throw new AppError(422, "Món không phù hợp ràng buộc hiện tại.");
    ok(
      res,
      await db.planItem.update({
        where: { id: i.id },
        data: {
          ...d,
          snapshot: {
            ...scale(r, 1),
            name: r.name,
            image: r.image,
            cost: r.cost,
          },
        },
      }),
    );
  }),
);
plans.delete(
  "/meal-plan-items/:id",
  wrap(async (req, res) => {
    const i = await db.planItem.findFirst({
      where: { id: String(req.params.id), plan: { userId: req.user.id } },
    });
    if (!i) throw new AppError(404, "Không tìm thấy.");
    await db.planItem.delete({ where: { id: i.id } });
    ok(res, { deleted: true });
  }),
);
plans.post(
  "/meal-plans/:id/apply",
  wrap(async (req, res) => {
    const p = await owned(req.user.id, String(req.params.id));
    const d = z
      .object({ itemIds: z.array(z.string()).min(1).max(124) })
      .parse(req.body);
    const selected = p.items.filter((i) => d.itemIds.includes(i.id));
    if (selected.length !== new Set(d.itemIds).size)
      throw new AppError(400, "Bữa không thuộc thực đơn.");
    const result = await db.$transaction(async (tx) => {
      let count = 0;
      for (const i of selected) {
        const claimed = await tx.planItem.updateMany({
          where: { id: i.id, consumed: false },
          data: { consumed: true },
        });
        if (!claimed.count) continue;
        const n = i.snapshot as any;
        await tx.diaryEntry.upsert({
          where: { planItemId: i.id },
          update: {},
          create: {
            userId: req.user.id,
            date: i.date,
            meal: i.meal,
            recipeId: i.recipeId,
            name: n.name,
            image: n.image,
            quantity: i.servings,
            unit: "khẩu phần",
            baseSnapshot: n,
            ...scale(n, i.servings),
            planItemId: i.id,
          },
        });
        count++;
      }
      return count;
    });
    ok(res, { recorded: result });
  }),
);
plans.get(
  "/shopping-lists",
  wrap(async (req, res) =>
    ok(
      res,
      await db.shoppingItem.findMany({
        where: {
          userId: req.user.id,
          excluded: false,
          ...(req.query.planId ? { planId: String(req.query.planId) } : {}),
        },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      }),
    ),
  ),
);
plans.post(
  "/shopping-lists/generate",
  wrap(async (req, res) => {
    const { planId } = z.object({ planId: z.string() }).parse(req.body),
      p = await owned(req.user.id, planId);
    const grouped = new Map<string, any>();
    for (const item of p.items)
      for (const ingredient of item.recipe.ingredients) {
        const grams = (ingredient.grams / item.recipe.servings) * item.servings;
        const old = grouped.get(ingredient.foodId) || {
          foodId: ingredient.foodId,
          name: ingredient.food.name,
          category: ingredient.food.category.name,
          grams: 0,
          cost: 0,
        };
        old.grams += grams;
        old.cost += (ingredient.food.pricePer100g * grams) / 100;
        grouped.set(ingredient.foodId, old);
      }
    const result = await db.$transaction(async (tx) => {
      const previous = await tx.shoppingItem.findMany({
        where: { userId: req.user.id, planId },
      });
      for (const item of grouped.values()) {
        const old = previous.find((s) => s.foodId === item.foodId);
        if (old)
          await tx.shoppingItem.update({
            where: { id: old.id },
            data: { ...item },
          });
        else
          await tx.shoppingItem.create({
            data: { ...item, userId: req.user.id, planId },
          });
      }
      await tx.shoppingItem.deleteMany({
        where: {
          userId: req.user.id,
          planId,
          foodId: { notIn: [...grouped.keys()] },
        },
      });
      return tx.shoppingItem.findMany({
        where: { userId: req.user.id, planId, excluded: false },
      });
    });
    ok(res, result);
  }),
);
plans.post(
  "/shopping-lists/items",
  wrap(async (req, res) => {
    const d = z
      .object({
        name: z.string().min(2).max(150),
        grams: z.number().positive().max(100000),
        cost: z.number().min(0).max(10000000),
        category: z.string().min(1).max(100),
      })
      .parse(req.body);
    ok(
      res,
      await db.shoppingItem.create({ data: { ...d, userId: req.user.id } }),
    );
  }),
);
plans.put(
  "/shopping-lists/items/:id",
  wrap(async (req, res) => {
    const d = z.object({ checked: z.boolean() }).parse(req.body);
    await db.shoppingItem.updateMany({
      where: { id: String(req.params.id), userId: req.user.id },
      data: d,
    });
    ok(res, d);
  }),
);
plans.delete(
  "/shopping-lists/items/:id",
  wrap(async (req, res) => {
    await db.shoppingItem.updateMany({
      where: { id: String(req.params.id), userId: req.user.id },
      data: { excluded: true },
    });
    ok(res, { deleted: true });
  }),
);
