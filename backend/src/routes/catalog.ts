import { Router } from "express";
import { z } from "zod";
import { db } from "../config/index.js";
import { wrap, ok, AppError, normalize, page, token } from "../utils/core.js";
import { food, recipe } from "../validators/index.js";
import { visible, recipeInclude, audit } from "../services/data.js";
import { decorateRecipe } from "../nutrition/engine.js";
export const catalog = Router();
catalog.get(
  "/categories",
  wrap(async (req, res) =>
    ok(res, await db.category.findMany({ orderBy: { name: "asc" } })),
  ),
);
catalog.get(
  "/favorites",
  wrap(async (req, res) =>
    ok(
      res,
      await db.favorite.findMany({
        where: { userId: req.user.id },
        include: {
          food: { include: { category: true } },
          recipe: { include: recipeInclude },
        },
      }),
    ),
  ),
);
for (const type of ["foods", "recipes"] as const) {
  const model = () => (type === "foods" ? db.food : db.recipe);
  catalog.get(
    "/" + type,
    wrap(async (req, res) => {
      const { take, skip, page: p } = page(req.query);
      const where: any = visible(req.user.id);
      if (req.query.scope === "mine") where.ownerId = req.user.id;
      if (req.query.featured === "true" && type === "recipes")
        where.slug = { startsWith: "editorial-dish-" };
      if (req.query.q)
        where.searchName = {
          contains: normalize(String(req.query.q)).slice(0, 150),
        };
      if (req.query.category && type === "foods")
        where.categoryId = String(req.query.category);
      if (req.query.meal && type === "recipes")
        where.mealType = String(req.query.meal);
      if (req.query.favorites === "true")
        where.favorites = { some: { userId: req.user.id } };
      if (type === "foods") {
        if (req.query.diet) where.diet = String(req.query.diet);
        if (req.query.maxCalories)
          where.calories = { lte: Number(req.query.maxCalories) || 1000 };
        if (req.query.minProtein)
          where.protein = { gte: Number(req.query.minProtein) || 0 };
      }
      if (type === "recipes") {
        const all = await db.recipe.findMany({
          where,
          include: {
            ...recipeInclude,
            favorites: { where: { userId: req.user.id }, select: { id: true } },
          },
        });
        const max = req.query.maxCalories
          ? z.coerce.number().min(0).max(10000).parse(req.query.maxCalories)
          : 10000;
        const min = req.query.minProtein
          ? z.coerce.number().min(0).max(500).parse(req.query.minProtein)
          : 0;
        const diet = String(req.query.diet || "");
        const items = all
          .map(decorateRecipe)
          .filter(
            (r) =>
              r.calories <= max &&
              r.protein >= min &&
              (!diet || r.diet === diet),
          );
        const sort = ["calories", "protein"].includes(String(req.query.sort))
          ? String(req.query.sort)
          : "name";
        items.sort((a: any, b: any) =>
          sort === "name"
            ? a.name.localeCompare(b.name, "vi")
            : a[sort] - b[sort],
        );
        ok(res, items.slice(skip, skip + take), {
          total: items.length,
          page: p,
          limit: take,
        });
        return;
      }
      const sort =
        type === "foods" &&
        ["calories", "protein"].includes(String(req.query.sort))
          ? String(req.query.sort)
          : "name";
      const m: any = model();
      const [items, total] = await Promise.all([
        m.findMany({
          where,
          take,
          skip,
          orderBy: { [sort]: "asc" },
          include:
            type === "foods"
              ? {
                  category: true,
                  favorites: {
                    where: { userId: req.user.id },
                    select: { id: true },
                  },
                }
              : {
                  ...recipeInclude,
                  favorites: {
                    where: { userId: req.user.id },
                    select: { id: true },
                  },
                },
        }),
        m.count({ where }),
      ]);
      ok(res, items, {
        total,
        page: p,
        limit: take,
      });
    }),
  );
  catalog.get(
    "/" + type + "/:id",
    wrap(async (req, res) => {
      const m: any = model();
      const item = await m.findFirst({
        where: { id: String(req.params.id), ...visible(req.user.id) },
        include:
          type === "foods"
            ? { category: true, favorites: { where: { userId: req.user.id } } }
            : {
                ...recipeInclude,
                favorites: { where: { userId: req.user.id } },
              },
      });
      if (!item) throw new AppError(404, "Không tìm thấy.");
      ok(res, type === "recipes" ? decorateRecipe(item) : item);
    }),
  );
  const save = wrap(async (req, res) => {
    const id = req.params.id ? String(req.params.id) : undefined,
      m: any = model();
    if (id) {
      const old = await m.findUnique({ where: { id } });
      if (!old) throw new AppError(404, "Không tìm thấy.");
      if (req.user.role !== "ADMIN" && old.ownerId !== req.user.id)
        throw new AppError(403, "Bạn không có quyền chỉnh sửa.");
    }
    const data: any =
      type === "foods" ? food.parse(req.body) : recipe.parse(req.body);
    data.searchName = normalize(data.name);
    if (
      type === "foods" &&
      !(await db.category.findUnique({ where: { id: data.categoryId } }))
    )
      throw new AppError(400, "Danh mục không tồn tại.");
    let ingredients: any[] = [];
    if (type === "recipes") {
      ingredients = data.ingredients;
      delete data.ingredients;
      const count = await db.food.count({
        where: {
          ...visible(req.user.id),
          id: { in: ingredients.map((i) => i.foodId) },
        },
      });
      if (count !== ingredients.length)
        throw new AppError(400, "Nguyên liệu không hợp lệ.");
    }
    const item = await db.$transaction(async (tx: any) => {
      const target = type === "foods" ? tx.food : tx.recipe;
      if (type === "recipes" && id)
        await tx.ingredient.deleteMany({ where: { recipeId: id } });
      const d = {
        ...data,
        ...(type === "recipes" ? { ingredients: { create: ingredients } } : {}),
      };
      return id
        ? target.update({ where: { id }, data: d })
        : target.create({
            data: {
              ...d,
              slug:
                normalize(data.name).replace(/[^a-z0-9]+/g, "-") +
                "-" +
                token().slice(0, 8),
              ownerId: req.user.role === "ADMIN" ? null : req.user.id,
            },
          });
    });
    await audit(req.user.id, id ? "update" : "create", type + ":" + item.id);
    res.status(id ? 200 : 201);
    ok(res, item);
  });
  catalog.post("/" + type, save);
  catalog.put("/" + type + "/:id", save);
  catalog.delete(
    "/" + type + "/:id",
    wrap(async (req, res) => {
      const m: any = model(),
        id = String(req.params.id);
      const old = await m.findUnique({ where: { id } });
      if (!old) throw new AppError(404, "Không tìm thấy.");
      if (req.user.role !== "ADMIN" && old.ownerId !== req.user.id)
        throw new AppError(403, "Bạn không có quyền xóa.");
      await m.update({ where: { id }, data: { archived: true } });
      await audit(req.user.id, "archive", type + ":" + id);
      ok(res, { archived: true });
    }),
  );
  catalog.post(
    "/" + type + "/:id/favorite",
    wrap(async (req, res) => {
      const id = String(req.params.id),
        key = type === "foods" ? "foodId" : "recipeId",
        m: any = model();
      if (!(await m.findFirst({ where: { id, ...visible(req.user.id) } })))
        throw new AppError(404, "Không tìm thấy.");
      const existing = await db.favorite.findFirst({
        where: { userId: req.user.id, [key]: id },
      });
      if (existing) await db.favorite.delete({ where: { id: existing.id } });
      else
        await db.favorite.create({ data: { userId: req.user.id, [key]: id } });
      ok(res, { favorite: !existing });
    }),
  );
}
