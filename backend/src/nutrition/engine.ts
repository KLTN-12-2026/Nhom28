import {normalize} from '../utils/core.js';
export type Nutrients = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};
export const empty = (): Nutrients => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
});
export const round = (n: number) => Math.round(n * 10) / 10;
export const scale = (n: Nutrients, factor: number): Nutrients =>
  Object.fromEntries(
    Object.keys(empty()).map((k) => [
      k,
      round(n[k as keyof Nutrients] * factor),
    ]),
  ) as Nutrients;
export const sum = (items: Partial<Nutrients>[]): Nutrients => {
  const total = empty();
  for (const i of items)
    for (const k of Object.keys(total) as (keyof Nutrients)[])
      total[k] += i[k] || 0;
  return scale(total, 1);
};
export const recipeNutrition = (
  recipe: any,
): Nutrients & { cost: number; allergens: string[]; diet: string } => {
  const ingredients = recipe.ingredients || [];
  const nutrients = sum(
    ingredients.map((i: any) => scale(i.food, i.grams / 100 / recipe.servings)),
  );
  const allergens = [
    ...new Set<string>(
      ingredients.flatMap((i: any) => i.food.allergens as string[]),
    ),
  ];
  const diets = ingredients.map((i: any) => i.food.diet);
  return {
    ...nutrients,
    cost: round(
      ingredients.reduce(
        (s: number, i: any) =>
          s + (i.food.pricePer100g * i.grams) / 100 / recipe.servings,
        0,
      ),
    ),
    allergens,
    diet: diets.includes("normal")
      ? "normal"
      : diets.includes("vegetarian")
        ? "vegetarian"
        : "vegan",
  };
};
export const decorateRecipe = (r: any) => ({ ...r, ...recipeNutrition(r) });
export function estimate(p: {
  age: number;
  sex: string;
  height: number;
  weight: number;
  activity: number;
  objective: string;
}) {
  const bmi = round(p.weight / (p.height / 100) ** 2);
  if (p.sex === "unspecified")
    return {
      bmi,
      bmr: null,
      tdee: null,
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
      note: "Cần cung cấp giới tính dùng trong công thức để ước tính Mifflin–St Jeor. Bạn có thể đặt mục tiêu thủ công.",
    };
  const bmr = round(
    10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === "male" ? 5 : -161),
  );
  const tdee = round(bmr * p.activity);
  const calories = Math.round(
    Math.max(
      1200,
      Math.min(
        4500,
        tdee +
          (p.objective === "lose" ? -300 : p.objective === "gain" ? 300 : 0),
      ),
    ),
  );
  return {
    bmi,
    bmr,
    tdee,
    calories,
    protein: round((calories * 0.25) / 4),
    carbs: round((calories * 0.45) / 4),
    fat: round((calories * 0.3) / 9),
    note:
      "Ước tính Mifflin–St Jeor cho người trưởng thành, hệ số vận động " +
      p.activity +
      ". Không phải chỉ định y tế.",
  };
}
export function isEligible(recipe: any, p: any) {
  const n = recipeNutrition(recipe),
    allergens = (p.allergens || []) as string[];
  return (
    !recipe.archived &&
    !recipe.ingredients.some((i: any) => i.food.archived) &&
    !n.allergens.some((a) =>
      allergens.some((b) => normalize(b.trim()) === normalize(a.trim())),
    ) &&
    !recipe.ingredients.some((i: any) =>
      allergens.some((a) =>
        i.food.searchName.includes(normalize(a.trim())),
      ),
    ) &&
    (p.diet === "normal" ||
      p.diet === "high-protein" ||
      n.diet === "vegan" ||
      (p.diet === "vegetarian" && n.diet === "vegetarian")) &&
    recipe.minutes <= p.cookingMinutes &&
    !(p.dislikes || "")
      .split(",")
      .filter(Boolean)
      .some((s: string) =>
        recipe.searchName.includes(normalize(s.trim())) || recipe.ingredients.some((i:any)=>i.food.searchName.includes(normalize(s.trim()))),
      )
  );
}
