import { z } from "zod";
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !isNaN(Date.parse(s)) &&
      new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s,
    "Ngày không hợp lệ",
  );
export const meal = z.enum(["breakfast", "lunch", "dinner", "snack"]);
export const password = z
  .string()
  .min(8)
  .max(72)
  .regex(/[A-Za-z]/, "Mật khẩu cần có chữ")
  .regex(/[0-9]/, "Mật khẩu cần có số");
export const profile = z.object({
  age: z.number().int().min(18).max(100),
  sex: z.enum(["male", "female", "unspecified"]),
  height: z.number().min(100).max(230),
  weight: z.number().min(30).max(300),
  targetWeight: z.number().min(30).max(300),
  activity: z.union([
    z.literal(1.2),
    z.literal(1.375),
    z.literal(1.55),
    z.literal(1.725),
    z.literal(1.9),
  ]),
  objective: z.enum(["lose", "maintain", "gain", "balance"]),
  diet: z.enum(["normal", "vegetarian", "vegan", "high-protein"]),
  allergens: z.array(z.string().min(1).max(80)).max(30),
  dislikes: z.string().max(500),
  budget: z.number().min(20000).max(3000000),
  cookingMinutes: z.number().int().min(5).max(180),
  meals: z.number().int().min(3).max(4),
  aiConsent: z.boolean(),
  chatConsent: z.boolean(),
  onboarded: z.boolean(),
  onboardingStep: z.number().int().min(0).max(7),
});
export const goal = z
  .object({
    calories: z.number().min(1200).max(4500),
    protein: z.number().min(20).max(350),
    carbs: z.number().min(50).max(700),
    fat: z.number().min(20).max(200),
    effectiveDate: date,
  })
  .refine(
    (g) =>
      Math.abs(g.protein * 4 + g.carbs * 4 + g.fat * 9 - g.calories) <=
      g.calories * 0.15,
    "Tổng năng lượng macro phải gần mục tiêu calo (±15%)",
  );
export const image = z
  .string()
  .max(1000)
  .refine(
    (s) =>
      s === "" ||
      /^\/(uploads|images)\/[a-zA-Z0-9_.-]+$/.test(s) ||
      /^https:\/\//.test(s),
    "Ảnh phải dùng HTTPS hoặc ảnh tải lên",
  );
export const food = z
  .object({
    name: z.string().min(2).max(150),
    description: z.string().max(3000),
    image,
    categoryId: z.string().min(1),
    calories: z.number().min(0).max(1000),
    protein: z.number().min(0).max(100),
    carbs: z.number().min(0).max(100),
    fat: z.number().min(0).max(100),
    fiber: z.number().min(0).max(100),
    servingGrams: z.number().min(1).max(2000),
    allergens: z.array(z.string().max(80)).max(30),
    diet: z.enum(["normal", "vegetarian", "vegan"]),
    source: z.string().min(5).max(500),
    pricePer100g: z.number().min(0).max(2000000),
  })
  .refine(
    (f) => f.protein + f.carbs + f.fat <= 105,
    "Tổng macro trên 100g không hợp lý",
  );
export const recipe = z
  .object({
    name: z.string().min(2).max(150),
    description: z.string().max(3000),
    image,
    steps: z.array(z.string().min(1).max(1000)).min(1).max(30),
    servings: z.number().min(0.25).max(20),
    minutes: z.number().int().min(1).max(240),
    mealType: meal,
    tags: z.array(z.string().max(50)).max(20),
    ingredients: z
      .array(
        z.object({ foodId: z.string(), grams: z.number().min(1).max(5000) }),
      )
      .min(1)
      .max(40),
  })
  .refine(
    (r) =>
      new Set(r.ingredients.map((i) => i.foodId)).size === r.ingredients.length,
    "Không nhập trùng nguyên liệu",
  );
export const diary = z
  .object({
    date,
    meal,
    foodId: z.string().optional(),
    recipeId: z.string().optional(),
    quantity: z.number().positive().max(5000),
  })
  .refine(
    (d) => !!d.foodId !== !!d.recipeId,
    "Chọn một thực phẩm hoặc một công thức",
  );
export const measurement = z.object({
  date,
  weight: z.number().min(30).max(300),
  height: z.number().min(100).max(230),
  note: z.string().max(500).default(""),
});
export const generation = z.object({
  startDate: date,
  days: z.union([z.literal(1), z.literal(3), z.literal(7)]),
  meals: z.number().int().min(3).max(4),
  budget: z.number().min(20000).max(3000000),
  cookingMinutes: z.number().int().min(5).max(180),
});
