import { db } from "../config/index.js";
import { AppError, today, addDays } from "../utils/core.js";
import { scale, sum, decorateRecipe, empty } from "../nutrition/engine.js";
export const recipeInclude = {
  ingredients: { include: { food: { include: { category: true } } } },
} as const;
export const visible = (userId: string) => ({
  archived: false,
  OR: [{ ownerId: null }, { ownerId: userId }],
});
export const audit = (actorId: string, action: string, resource: string) =>
  db.auditLog.create({ data: { actorId, action, resource } });
export async function currentGoal(userId: string, date = today()) {
  return await db.goal.findFirst({
    where: { userId, effectiveDate: { lte: date } },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
  });
}
export async function snapshot(
  userId: string,
  d: { foodId?: string; recipeId?: string; quantity: number },
) {
  if (d.foodId) {
    const f = await db.food.findFirst({
      where: { id: d.foodId, ...visible(userId) },
    });
    if (!f) throw new AppError(404, "Thực phẩm không tồn tại.");
    return {
      name: f.name,
      image: f.image,
      foodId: f.id,
      recipeId: null,
      unit: "g",
      baseSnapshot: { ...scale(f, 0.01), name: f.name, image: f.image },
      ...scale(f, d.quantity / 100),
    };
  }
  const r = await db.recipe.findFirst({
    where: { id: d.recipeId, ...visible(userId) },
    include: recipeInclude,
  });
  if (!r) throw new AppError(404, "Công thức không tồn tại.");
  const n = decorateRecipe(r);
  return {
    name: r.name,
    image: r.image,
    foodId: null,
    recipeId: r.id,
    unit: "khẩu phần",
    baseSnapshot: { ...scale(n, 1), name: r.name, image: r.image },
    ...scale(n, d.quantity),
  };
}
export async function dashboard(userId: string, date = today(), days = 7) {
  const from = addDays(date, -days + 1);
  const [entries, goals, measurements, profile] = await Promise.all([
    db.diaryEntry.findMany({
      where: { userId, date: { gte: from, lte: date } },
      orderBy: { createdAt: "asc" },
    }),
    db.goal.findMany({
      where: { userId, effectiveDate: { lte: date } },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    }),
    db.measurement.findMany({
      where: { userId },
      orderBy: { date: "asc" },
      take: 1000,
    }),
    db.profile.findUnique({ where: { userId } }),
  ]);
  const series = Array.from({ length: days }, (_, i) => {
    const d = addDays(from, i),
      es = entries.filter((e) => e.date === d),
      g = goals.find((x) => x.effectiveDate <= d);
    return {
      date: d,
      ...sum(es),
      target: g?.calories || 0,
      logged: es.length > 0,
    };
  });
  const current = entries.filter((e) => e.date === date),
    goal = goals.find((g) => g.effectiveDate <= date) || null,
    total = sum(current);
  const insights = [];
  if (!goal) insights.push("Thiết lập mục tiêu để theo dõi tiến độ.");
  else {
    insights.push(
      `Đã ghi nhận ${Math.round(total.calories)} / ${Math.round(goal.calories)} kcal hôm nay.`,
    );
    if (total.protein < goal.protein)
      insights.push(
        `Còn ${Math.round(goal.protein - total.protein)}g protein so với mục tiêu.`,
      );
    if (total.calories > goal.calories)
      insights.push(
        `Năng lượng vượt mục tiêu ${Math.round(total.calories - goal.calories)} kcal.`,
      );
  }
  return {
    date,
    total,
    goal,
    entries: current,
    series,
    measurements,
    profile,
    insights,
    loggedDays: series.filter((s) => s.logged).length,
    average: Math.round(series.reduce((s, d) => s + d.calories, 0) / days),
    mealCount: new Set(current.map((e) => e.meal)).size,
  };
}
