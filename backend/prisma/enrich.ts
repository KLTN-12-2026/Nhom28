import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { dishes, extraFoods } from "./editorial-data.js";
import { editorialArticles } from "./editorial-articles.js";
import { normalize, today, addDays } from "../src/utils/core.js";
import { decorateRecipe, scale } from "../src/nutrition/engine.js";
const db = new PrismaClient();
const image = (key: string) => "/images/" + key + ".jpg";
async function main() {
  let foodIndex = 0;
  for (const group of extraFoods) {
    const category = await db.category.findUniqueOrThrow({
      where: { name: group.category },
    });
    for (const name of group.names.split(",")) {
      foodIndex++;
      if (await db.food.findFirst({ where: { name, ownerId: null } })) continue;
      const allergens =
        group.category === "Cá & hải sản"
          ? ["Hải sản"]
          : group.category === "Sữa & trứng"
            ? name.includes("Trứng")
              ? ["Trứng"]
              : ["Sữa"]
            : group.category === "Hạt & quả hạch"
              ? ["Các loại hạt"]
              : name.includes("Đậu hũ") || name.includes("Đậu nành")
                ? ["Đậu nành"]
                : /Mì|Nui|Bánh pita|Lúa mì/.test(name)
                  ? ["Gluten"]
                  : [];
      await db.food.upsert({
        where: { slug: "editorial-food-" + foodIndex },
        update: {},
        create: {
          slug: "editorial-food-" + foodIndex,
          name,
          searchName: normalize(name),
          description: `${name}, phần ăn được theo 100g. Định lượng tham khảo cho công thức gia đình. Dữ liệu demo ước tính; đối chiếu trạng thái sống/chín và nhãn sản phẩm khi sử dụng thực tế.`,
          image: image(group.image),
          categoryId: category.id,
          calories: Math.round(group.p * 4 + group.c * 4 + group.f * 9),
          protein: group.p,
          carbs: group.c,
          fat: group.f,
          fiber: group.diet === "vegan" ? 2 : 0,
          servingGrams: 100,
          allergens,
          diet: group.diet,
          source: "Bộ dữ liệu trải nghiệm NutriAI — ước tính, chưa thẩm định",
          pricePer100g: group.diet === "normal" ? 22000 : 6000,
        },
      });
    }
  }
  const foods = await db.food.findMany({
      where: { ownerId: null, archived: false },
    }),
    byName = new Map(foods.map((f) => [f.name, f]));
  // Correct explicit ingredient metadata only on the original demo records.
  for (const [name, diet, allergens] of [
    ["Mì trứng", "vegetarian", ["Gluten", "Trứng"]],
    ["Nước mắm", "normal", ["Hải sản"]],
    ["Mật ong", "vegetarian", []],
    ["Sữa hạnh nhân", "vegan", ["Các loại hạt"]],
  ] as const) {
    await db.food.updateMany({
      where: {
        name,
        slug: { startsWith: "demo-food-" },
        ownerId: null,
        source: "Dữ liệu demo ước tính, không dùng làm dữ liệu lâm sàng",
      },
      data: { diet, allergens: [...allergens] },
    });
  }
  const curated: any[] = [];
  for (let i = 0; i < dishes.length; i++) {
    const [
      name,
      mealType,
      img,
      minutes,
      ingredients,
      preparation,
      cooking,
      tag,
    ] = dishes[i];
    const missing = ingredients.filter(([name]) => !byName.has(name));
    if (missing.length)
      throw Error("Missing ingredient: " + JSON.stringify(missing));
    const r = await db.recipe.upsert({
      where: { slug: "editorial-dish-" + (i + 1) },
      update: {},
      create: {
        slug: "editorial-dish-" + (i + 1),
        name,
        searchName: normalize(name),
        description: `${name} là một lựa chọn ${mealType === "breakfast" ? "bữa sáng" : mealType === "lunch" ? "bữa trưa" : mealType === "dinner" ? "bữa tối" : "bữa phụ"} dễ đưa vào lịch ăn hàng ngày. Công thức ghi rõ từng nguyên liệu, cách chuẩn bị và một khẩu phần để bạn chủ động điều chỉnh. ${tag === "Thuần chay" ? "Ưu tiên nguyên liệu thực vật và cách nấu đơn giản." : tag === "Giàu protein" ? "Kết hợp nguồn đạm cùng các thành phần quen thuộc." : "Dùng nguyên liệu quen thuộc trong căn bếp Việt."} Ảnh minh họa; số liệu dinh dưỡng là ước tính từ nguyên liệu demo.`,
        image: image(img),
        servings: 1,
        minutes,
        mealType,
        tags: [tag, "Công thức chọn lọc", "Bếp nhà NutriAI"],
        steps: [
          `Chuẩn bị cho 1 khẩu phần: ${ingredients.map(([name, grams]) => `${grams}g ${name.toLowerCase()}`).join(", ")}. Khi nấu nhiều phần, nhân đồng đều lượng nguyên liệu.`,
          preparation,
          cooking,
          "Chia món theo số khẩu phần đã chuẩn bị. Dầu, topping, sốt hoặc đồ uống thêm ngoài danh sách cần được ghi riêng nếu bạn dùng.",
          "Dùng ngay sau khi chế biến, hoặc làm nguội và bảo quản trong hộp sạch theo hướng dẫn an toàn của từng nguyên liệu. Kiểm tra lại dị ứng và thành phần nhãn sản phẩm trước khi nấu.",
        ],
        ingredients: {
          create: ingredients.map(([name, grams]) => ({
            foodId: byName.get(name)!.id,
            grams,
          })),
        },
      },
      include: {
        ingredients: { include: { food: { include: { category: true } } } },
      },
    });
    curated.push(decorateRecipe(r));
  }
  for (const article of editorialArticles) {
    const { sections, ...data } = article;
    await db.article.upsert({
      where: { slug: "editorial-" + data.slug },
      update: {},
      create: {
        ...data,
        slug: "editorial-" + data.slug,
        image: image(data.image),
        published: true,
        content:
          sections
            .map(([heading, body]) => "## " + heading + "\n" + body)
            .join("\n\n") +
          "\n\n## Ghi chú\nNội dung hướng dẫn sử dụng và kiến thức phổ thông, không thay thế tư vấn chuyên môn. Dữ liệu thực phẩm demo được ghi nhãn ước tính.",
      },
    });
  }
  const admin = await db.user.findUniqueOrThrow({
    where: { email: "admin@nutriai.vn" },
  });
  const collections = [
    ["Bếp Việt thân quen", "Món Việt"],
    ["Bữa ăn thuần chay", "Thuần chay"],
    ["Protein cho ngày năng động", "Giàu protein"],
    ["Một ngày thật gọn", "Nhanh gọn"],
    ["Chuẩn bị trước, thảnh thơi sau", "Chuẩn bị trước"],
    ["Sắc màu trong từng bữa", "Công thức chọn lọc"],
  ];
  for (let n = 0; n < collections.length; n++) {
    const [name, tag] = collections[n],
      id = "editorial-template-" + n;
    if (await db.mealPlan.findUnique({ where: { id } })) continue;
    const pool = curated.filter((r) => (r.tags as string[]).includes(tag));
    const items: any[] = [];
    for (let day = 0; day < 3; day++)
      for (const meal of ["breakfast", "lunch", "dinner", "snack"]) {
        let options = pool.filter((r) => r.mealType === meal);
        if (!options.length)
          options =
            tag === "Thuần chay"
              ? curated.filter((r) => r.diet === "vegan" && r.mealType === meal)
              : curated.filter((r) => r.mealType === meal);
        if (!options.length) options = pool;
        const r = options[(day + n) % options.length];
        if (!r) continue;
        items.push({
          recipeId: r.id,
          date: addDays(today(), day),
          meal,
          servings: 1,
          snapshot: {
            ...scale(r, 1),
            name: r.name,
            image: r.image,
            cost: r.cost,
          },
        });
      }
    await db.mealPlan.create({
      data: {
        id,
        userId: admin.id,
        name,
        days: 3,
        startDate: today(),
        mode: "manual",
        isTemplate: true,
        published: true,
        explanation: `Bộ sưu tập ${name.toLowerCase()} gồm các công thức có định lượng, hướng dẫn và nguyên liệu dễ tìm. Đây là mẫu tham khảo do biên tập, chưa cân đối theo mục tiêu riêng của bạn. Khi sao chép, hãy kiểm tra dị ứng, chế độ ăn và điều chỉnh khẩu phần.`,
        goalSnapshot: {
          note: "Mẫu biên tập tham khảo, không phải mục tiêu cá nhân",
        },
        items: { create: items },
      },
    });
  }
  const demo = await db.user.findUniqueOrThrow({
    where: { email: "demo@nutriai.vn" },
  });
  const date = today();
  if (!(await db.hydrationLog.count({ where: { userId: demo.id, date } })))
    await db.hydrationLog.createMany({
      data: [250, 250, 300, 250].map((amountMl, i) => ({
        id: "editorial-water-" + date + "-" + i,
        userId: demo.id,
        date,
        amountMl,
        createdAt: new Date(Date.now() - (4 - i) * 45 * 60000),
      })),
    });
  for (let i = 0; i < 4; i++)
    await db.hydrationLog.updateMany({
      where: {
        id: "editorial-water-" + date + "-" + i,
        userId: demo.id,
        createdAt: { gt: new Date() },
      },
      data: { createdAt: new Date(Date.now() - (4 - i) * 45 * 60000) },
    });
  const counts = {
    foods: await db.food.count({ where: { archived: false, ownerId: null } }),
    recipes: await db.recipe.count({
      where: { archived: false, ownerId: null },
    }),
    articles: await db.article.count({ where: { published: true } }),
    templates: await db.mealPlan.count({
      where: { isTemplate: true, published: true },
    }),
  };
  console.log("Editorial data ready:", JSON.stringify(counts));
}
main().finally(() => db.$disconnect());
