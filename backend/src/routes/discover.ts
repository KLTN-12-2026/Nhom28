import { Router } from "express";
import { db } from "../config/index.js";
import { wrap, ok } from "../utils/core.js";
import { recipeInclude } from "../services/data.js";
import { decorateRecipe } from "../nutrition/engine.js";
export const discover = Router();
discover.get(
  "/explore",
  wrap(async (_req, res) => {
    const [foods, recipes, articles, categories, templates] = await Promise.all(
      [
        db.food.count({ where: { ownerId: null, archived: false } }),
        db.recipe.findMany({
          where: { ownerId: null, archived: false },
          include: recipeInclude,
          orderBy: { createdAt: "desc" },
        }),
        db.article.findMany({
          where: { published: true },
          orderBy: { createdAt: "desc" },
          take: 18,
        }),
        db.category.findMany({
          include: { _count: { select: { foods: true } } },
        }),
        db.mealPlan.findMany({
          where: { isTemplate: true, published: true },
          select: {
            id: true,
            name: true,
            days: true,
            explanation: true,
            items: {
              select: {
                snapshot: true,
                servings: true,
                date: true,
                meal: true,
              },
            },
          },
          take: 12,
        }),
      ],
    );
    const curated = recipes.filter((r) => r.slug.startsWith("editorial-"));
    res.set("Cache-Control", "public, max-age=30");
    ok(res, {
      stats: {
        foods,
        recipes: recipes.length,
        articles: articles.length,
        categories: categories.length,
        templates: templates.length,
      },
      recipes: (curated.length ? curated : recipes)
        .slice(0, 72)
        .map(decorateRecipe),
      articles,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        count: c._count.foods,
      })),
      templates,
    });
  }),
);
