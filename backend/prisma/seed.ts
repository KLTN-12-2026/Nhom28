import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { normalize, today, addDays } from "../src/utils/core.js";
import { decorateRecipe, scale, isEligible } from "../src/nutrition/engine.js";
import { fallbackSelection } from "../src/services/recommendation.js";
const db = new PrismaClient();
const images = {
  bowl: "/images/bowl.jpg",
  salad: "/images/salad.jpg",
  chicken: "/images/chicken.jpg",
  fruit: "/images/fruit.jpg",
  oats: "/images/oats.jpg",
  fish: "/images/fish.jpg",
};
const groups: [
  string,
  string[],
  number,
  number,
  number,
  string[],
  string,
  string,
][] = [
  [
    "Ngũ cốc & tinh bột",
    "Cơm trắng,Cơm gạo lứt,Cơm nếp,Bún tươi,Phở tươi,Mì trứng,Mì gạo,Bánh mì,Bánh mì nguyên cám,Yến mạch,Khoai lang,Khoai tây,Khoai môn,Bắp ngọt,Miến dong,Hạt quinoa,Lúa mạch,Gạo tẻ,Gạo nếp,Gạo lứt,Bánh phở khô,Bún gạo khô,Nui luộc,Bánh đa,Kiều mạch".split(
      ",",
    ),
    3,
    28,
    1,
    [],
    "vegan",
    images.bowl,
  ],
  [
    "Thịt & gia cầm",
    "Ức gà,Đùi gà,Thịt gà ta,Thịt bò nạc,Thăn bò,Bắp bò,Thịt heo nạc,Thăn heo,Sườn heo,Thịt vịt,Ức vịt,Thịt ngan,Thịt ngỗng,Thịt cừu,Thịt dê,Thịt thỏ,Thịt bê,Gan gà,Gan heo,Tim heo,Tim gà,Cánh gà,Gà tây,Thịt bò xay,Thịt heo xay".split(
      ",",
    ),
    23,
    0,
    7,
    [],
    "normal",
    images.chicken,
  ],
  [
    "Cá & hải sản",
    "Cá hồi,Cá thu,Cá ngừ,Cá basa,Cá lóc,Cá rô phi,Cá chép,Cá trắm,Cá diêu hồng,Cá bống,Cá nục,Cá cơm,Cá mòi,Cá trích,Cá đuối,Tôm sú,Tôm thẻ,Cua biển,Ghẹ,Mực ống,Bạch tuộc,Nghêu,Sò huyết,Hàu,Ốc hương".split(
      ",",
    ),
    20,
    1,
    5,
    ["Hải sản"],
    "normal",
    images.fish,
  ],
  [
    "Rau lá",
    "Rau muống,Cải bó xôi,Cải thìa,Cải ngọt,Cải xanh,Cải bẹ,Cải thảo,Xà lách,Rau dền,Rau ngót,Mồng tơi,Rau đay,Rau lang,Tần ô,Rau má,Rau diếp cá,Rau cần,Cần tây,Bắp cải tím,Bắp cải trắng,Lá lốt,Rau răm,Húng quế,Tía tô,Ngò rí".split(
      ",",
    ),
    2,
    4,
    0.3,
    [],
    "vegan",
    images.salad,
  ],
  [
    "Củ quả & nấm",
    "Cà rốt,Bí đỏ,Bí xanh,Bầu,Mướp,Su su,Su hào,Củ cải trắng,Củ dền,Dưa leo,Cà chua,Cà tím,Ớt chuông,Súp lơ xanh,Súp lơ trắng,Đậu bắp,Đậu cô ve,Đậu đũa,Măng tây,Nấm rơm,Nấm hương,Nấm kim châm,Nấm đùi gà,Nấm mỡ,Măng tươi".split(
      ",",
    ),
    2,
    7,
    0.3,
    [],
    "vegan",
    images.salad,
  ],
  [
    "Trái cây",
    "Chuối,Táo,Cam,Quýt,Bưởi,Xoài,Đu đủ,Dưa hấu,Dưa lưới,Thanh long,Ổi,Lê,Nho,Dâu tây,Việt quất,Mâm xôi,Kiwi,Dứa,Chanh leo,Mít,Na,Vải,Nhãn,Chôm chôm,Lựu".split(
      ",",
    ),
    0.8,
    15,
    0.3,
    [],
    "vegan",
    images.fruit,
  ],
  [
    "Đậu & sản phẩm đậu",
    "Đậu phụ,Đậu nành,Đậu xanh,Đậu đỏ,Đậu đen,Đậu trắng,Đậu Hà Lan,Đậu gà,Đậu lăng đỏ,Đậu lăng xanh,Đậu ngự,Đậu ván,Đậu hũ non,Đậu hũ ky,Tương đậu,Sữa đậu nành,Tempeh,Đậu edamame,Đậu mắt đen,Đậu pinto,Đậu tằm,Đậu lăng vàng,Bột đậu xanh,Bột đậu nành,Đậu hũ chiên".split(
      ",",
    ),
    10,
    12,
    5,
    ["Đậu nành"],
    "vegan",
    images.bowl,
  ],
  [
    "Hạt & quả hạch",
    "Đậu phộng,Hạnh nhân,Óc chó,Hạt điều,Hạt dẻ,Hạt mắc ca,Hạt phỉ,Hạt hồ trăn,Hạt hướng dương,Hạt bí,Hạt chia,Hạt lanh,Mè trắng,Mè đen,Hạt sen,Hạt dưa,Hạt thông,Dừa khô,Cơm dừa,Bơ đậu phộng,Bơ hạnh nhân,Bột hạnh nhân,Hạt gai dầu,Hạt óc chó đen,Hạt Brazil".split(
      ",",
    ),
    16,
    20,
    44,
    ["Các loại hạt", "Đậu phộng"],
    "vegan",
    images.oats,
  ],
  [
    "Sữa & trứng",
    "Trứng gà,Trứng vịt,Trứng cút,Lòng trắng trứng,Lòng đỏ trứng,Sữa tươi nguyên kem,Sữa ít béo,Sữa tách béo,Sữa chua,Sữa chua Hy Lạp,Phô mai tươi,Phô mai cheddar,Phô mai mozzarella,Phô mai cottage,Sữa chua không đường,Sữa kefir,Sữa bột,Sữa đặc,Kem tươi,Bơ sữa,Sữa dê,Sữa chua uống,Trứng ngỗng,Trứng gà ta,Trứng vịt lộn".split(
      ",",
    ),
    9,
    6,
    8,
    ["Sữa", "Trứng"],
    "vegetarian",
    images.oats,
  ],
  [
    "Dầu & gia vị",
    "Dầu ô liu,Dầu mè,Dầu đậu nành,Dầu hướng dương,Dầu dừa,Dầu cải,Dầu gạo,Dầu đậu phộng,Nước mắm,Nước tương,Muối,Đường,Mật ong,Tiêu đen,Ớt bột,Gừng,Tỏi,Hành tím,Hành tây,Nghệ,Sả,Quế,Hồi,Giấm gạo,Chanh".split(
      ",",
    ),
    0.5,
    10,
    25,
    [],
    "vegan",
    images.bowl,
  ],
  [
    "Đồ uống",
    "Nước lọc,Trà xanh,Trà đen,Trà ô long,Trà hoa cúc,Trà gừng,Trà atiso,Cà phê đen,Nước dừa,Nước cam ép,Nước táo ép,Nước ép cà rốt,Nước ép dưa hấu,Sinh tố chuối,Sinh tố bơ,Sinh tố xoài,Sữa yến mạch,Sữa hạnh nhân,Sữa gạo,Sữa dừa,Nước chanh,Nước sâm,Nước ép ổi,Trà sen,Nước ép lựu".split(
      ",",
    ),
    0.3,
    8,
    0.2,
    [],
    "vegan",
    images.fruit,
  ],
  [
    "Bánh & thực phẩm khác",
    "Bánh cuốn,Bánh ướt,Bánh giò,Bánh bao,Bánh chưng,Bánh tét,Bánh đúc,Bánh bèo,Bánh nậm,Bánh bột lọc,Bánh khoai,Bánh ngô,Bánh chuối,Bánh gạo,Bánh quy yến mạch,Granola,Muesli,Rong biển,Kim chi,Dưa cải,Chả lụa,Chả cá,Giò bò,Chả chay,Seitan".split(
      ",",
    ),
    5,
    30,
    5,
    ["Gluten"],
    "normal",
    images.bowl,
  ],
];
async function main() {
  const passwordHash = await bcrypt.hash("NutriDemo123!", 12),
    users: any[] = [];
  for (let i = 0; i < 32; i++) {
    const email =
      i === 0
        ? "admin@nutriai.vn"
        : i === 1
          ? "demo@nutriai.vn"
          : `demo${i}@nutriai.vn`;
    const u = await db.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name:
          i === 0
            ? "Quản trị viên"
            : i === 1
              ? "Bùi Quốc Cường"
              : `Người dùng mẫu ${i}`,
        passwordHash,
        role: i === 0 ? "ADMIN" : "USER",
        profile: {
          create: {
            age: 24 + (i % 12),
            sex: i % 2 ? "male" : "female",
            height: 170,
            weight: 68 + (i % 8),
            targetWeight: 65,
            objective: "lose",
            allergens: [],
            onboarded: true,
            onboardingStep: 7,
            aiConsent: false,
            chatConsent: true,
            budget: 200000,
            cookingMinutes: 60,
          },
        },
        notifications: {
          create: {
            title: "Chào mừng đến NutriAI",
            body: "Đây là tài khoản demo. Dữ liệu thực phẩm được đánh dấu ước tính; bạn có thể tự thêm nhật ký và tạo thực đơn.",
          },
        },
      },
    });
    users.push(u);
    if (!(await db.goal.count({ where: { userId: u.id } })))
      await db.goal.create({
        data: {
          userId: u.id,
          calories: 2100,
          protein: 131.3,
          carbs: 236.3,
          fat: 70,
          effectiveDate: addDays(today(), -90),
        },
      });
  }
  let index = 0;
  const foods: any[] = [];
  for (const [name, names, p, c, f, allergens, diet, image] of groups) {
    const category = await db.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    for (const name of names) {
      index++;
      const delta = 0.85 + (index % 7) * 0.05;
      let protein = Math.round(p * delta * 10) / 10,
        carbs = Math.round(c * delta * 10) / 10,
        fat = Math.round(f * delta * 10) / 10;
      let tags = allergens;
      if (name === "Cơm trắng") {
        protein = 2.7;
        carbs = 28;
        fat = 0.3;
      }
      if (name === "Nước lọc" || /^Trà /.test(name)) {
        protein = 0;
        carbs = 0;
        fat = 0;
      }
      if (name.startsWith("Dầu ")) {
        protein = 0;
        carbs = 0;
        fat = 100;
      }
      if (name === "Muối") {
        protein = 0;
        carbs = 0;
        fat = 0;
      }
      if (name === "Đường") {
        protein = 0;
        carbs = 100;
        fat = 0;
      }
      if (name.startsWith("Trứng") || name.includes("trứng")) tags = ["Trứng"];
      if (
        name.includes("Bánh mì") ||
        name === "Mì trứng" ||
        name === "Lúa mạch"
      )
        tags = ["Gluten"];
      if (name === "Nước tương") tags = ["Đậu nành", "Gluten"];
      if (name === "Nước mắm") tags = ["Hải sản"];
      const calories =
        name === "Cơm trắng"
          ? 130
          : Math.round(protein * 4 + carbs * 4 + fat * 9);
      const record = await db.food.upsert({
        where: { slug: `demo-food-${index}` },
        update: {},
        create: {
          slug: `demo-food-${index}`,
          name,
          searchName: normalize(name),
          description: `${name} — thông tin trên 100g phần ăn được. Dữ liệu mô phỏng/ước tính phục vụ đồ án; cần đối chiếu nhãn hoặc nguồn dinh dưỡng trước khi dùng thực tế.`,
          image,
          categoryId: category.id,
          protein,
          carbs,
          fat,
          calories,
          fiber: ["Rau lá", "Củ quả & nấm", "Trái cây"].includes(category.name)
            ? 2.5
            : 0,
          allergens: tags,
          diet,
          pricePer100g:
            category.name === "Thịt & gia cầm"
              ? 18000
              : category.name === "Cá & hải sản"
                ? 23000
                : 4000,
        },
      });
      foods.push(record);
    }
  }
  const find = (name: string) => foods.find((f) => f.name === name)!;
  const bases = [
    {
      name: "Cơm gà",
      base: "Cơm trắng",
      main: "Ức gà",
      veg: "Súp lơ xanh",
      meal: "lunch",
      image: images.chicken,
    },
    {
      name: "Bún bò",
      base: "Bún tươi",
      main: "Thịt bò nạc",
      veg: "Rau muống",
      meal: "lunch",
      image: images.bowl,
    },
    {
      name: "Phở gà",
      base: "Phở tươi",
      main: "Ức gà",
      veg: "Cải thìa",
      meal: "breakfast",
      image: images.bowl,
    },
    {
      name: "Cá hồi và cơm lứt",
      base: "Cơm gạo lứt",
      main: "Cá hồi",
      veg: "Măng tây",
      meal: "dinner",
      image: images.fish,
    },
    {
      name: "Đậu phụ rau củ",
      base: "Cơm gạo lứt",
      main: "Đậu phụ",
      veg: "Cà rốt",
      meal: "dinner",
      image: images.salad,
    },
    {
      name: "Salad đậu gà",
      base: "Khoai lang",
      main: "Đậu gà",
      veg: "Xà lách",
      meal: "lunch",
      image: images.salad,
    },
    {
      name: "Yến mạch sữa chua",
      base: "Yến mạch",
      main: "Sữa chua Hy Lạp",
      veg: "Chuối",
      meal: "breakfast",
      image: images.oats,
    },
    {
      name: "Bánh mì trứng",
      base: "Bánh mì nguyên cám",
      main: "Trứng gà",
      veg: "Cà chua",
      meal: "breakfast",
      image: images.chicken,
    },
    {
      name: "Bát trái cây và đậu",
      base: "Táo",
      main: "Đậu nành",
      veg: "Dâu tây",
      meal: "snack",
      image: images.fruit,
    },
    {
      name: "Bún đậu chay",
      base: "Bún tươi",
      main: "Đậu phụ",
      veg: "Cải bó xôi",
      meal: "dinner",
      image: images.salad,
    },
  ];
  const methods = [
    "hấp gừng",
    "áp chảo tỏi",
    "trộn chanh",
    "nướng sả",
    "sốt tiêu",
    "sốt cà chua",
    "rau củ theo mùa",
    "mè rang",
    "nấm hương",
    "kiểu gia đình",
  ];
  const recipes: any[] = [];
  for (let b = 0; b < bases.length; b++)
    for (let variant = 0; variant < 10; variant++) {
      const base = bases[b];
      const fruits = [
        "Chuối",
        "Dâu tây",
        "Táo",
        "Xoài",
        "Kiwi",
        "Thanh long",
        "Việt quất",
        "Cam",
        "Lê",
        "Nho",
      ];
      const raw = b === 6 || b === 8;
      const style = raw
        ? `với ${fruits[variant].toLowerCase()}`
        : b === 2 || b === 1
          ? [
              "rau thơm",
              "nấm hương",
              "gừng tươi",
              "rau cải",
              "hành tây",
              "nước dùng thanh",
              "cà rốt",
              "rau muống",
              "nấm rơm",
              "kiểu gia đình",
            ][variant]
          : methods[variant];
      const name = `${base.name} ${style}`;
      const slug = `demo-recipe-${b * 10 + variant + 1}`;
      const factor = 0.85 + variant * 0.04;
      const extra =
        variant === 8
          ? find("Nấm hương")
          : variant === 7
            ? find("Mè trắng")
            : find("Dầu ô liu");
      const ingredients = [
        {
          foodId: find(base.base).id,
          grams: Math.round((base.meal === "snack" ? 100 : 170) * factor),
        },
        { foodId: find(base.main).id, grams: Math.round(150 * factor) },
        { foodId: find(raw ? fruits[variant] : base.veg).id, grams: 100 },
        { foodId: extra.id, grams: variant === 8 ? 40 : 8 },
      ];
      const merged = [...new Set(ingredients.map((i) => i.foodId))].map(
        (foodId) => ({
          foodId,
          grams: ingredients
            .filter((i) => i.foodId === foodId)
            .reduce((s, i) => s + i.grams, 0),
        }),
      );
      const r = await db.recipe.upsert({
        where: { slug },
        update: {},
        create: {
          slug,
          name,
          searchName: normalize(name),
          description:
            "Công thức demo ước tính, ưu tiên nguyên liệu dễ tìm. Hình ảnh minh họa nhóm món; thành phần thực tế theo danh sách nguyên liệu.",
          image: base.image,
          servings: 1,
          minutes: 15 + variant * 3,
          mealType: base.meal,
          tags: ["Món Việt", "Demo ước tính", style],
          steps: [
            `Chuẩn bị và cân ${find(base.base).name.toLowerCase()}, ${find(base.main).name.toLowerCase()} cùng rau củ. Rửa sạch nguyên liệu.`,
            raw
              ? "Ngâm và nấu chín đậu hoặc yến mạch nếu có, để nguội. Rửa sạch và cắt trái cây. Giữ sữa chua lạnh."
              : "Nấu phần tinh bột chín theo hướng dẫn. Chế biến nguồn đạm chín hoàn toàn; rau củ hấp hoặc xào nhẹ với lượng dầu ghi trong nguyên liệu.",
            raw
              ? "Trộn nguyên liệu đã nguội với trái cây, chia đúng khẩu phần và dùng ngay."
              : "Chia đúng khẩu phần và dùng ngay khi còn nóng.",
          ],
          ingredients: { create: merged },
        },
        include: { ingredients: { include: { food: true } } },
      });
      recipes.push(decorateRecipe(r));
    }
  for (const u of users.slice(1)) {
    if (await db.diaryEntry.count({ where: { userId: u.id } })) continue;
    const data: any[] = [];
    for (let day = -29; day <= 0; day++) {
      const date = addDays(today(), day);
      for (let m = 0; m < (day === 0 ? 2 : 4); m++) {
        const r = recipes[((day + 30) * 7 + m * 13) % recipes.length],
          quantity = m === 3 ? 0.5 : 1.2 + (day % 3) * 0.1;
        data.push({
          userId: u.id,
          date,
          meal: ["breakfast", "lunch", "dinner", "snack"][m],
          name: r.name,
          image: r.image,
          recipeId: r.id,
          quantity,
          unit: "khẩu phần",
          baseSnapshot: { ...scale(r, 1), name: r.name, image: r.image },
          ...scale(r, quantity),
        });
      }
      if (day % 3 === 0)
        await db.measurement.upsert({
          where: { userId_date: { userId: u.id, date } },
          update: {},
          create: {
            userId: u.id,
            date,
            weight: 72 - (day + 30) * 0.055 + (users.indexOf(u) % 4) * 0.2,
            height: 170,
            note: "Dữ liệu mẫu",
          },
        });
    }
    await db.diaryEntry.createMany({ data });
  }
  const articles = [
    [
      "Hiểu nhãn dinh dưỡng trên thực phẩm",
      "Kiến thức cơ bản",
      "Khi đọc nhãn, chú ý khẩu phần và số khẩu phần trong gói. Đơn vị 100g khác một khẩu phần.",
      "Kiểm tra năng lượng theo lượng thực sự bạn dùng. So sánh các sản phẩm cùng đơn vị. Thông tin trong ứng dụng demo có thể là ước tính; ưu tiên nhãn của sản phẩm thực tế.",
    ],
    [
      "Xây dựng bữa ăn cân bằng",
      "Thói quen",
      "Kết hợp nguồn tinh bột, protein, rau và chất béo trong bữa ăn.",
      "Đa dạng nguyên liệu trong tuần và điều chỉnh lượng ăn dựa trên mục tiêu của bạn. Ghi nhật ký để quan sát thói quen. Các mục tiêu trong ứng dụng là tham khảo cho người trưởng thành; nhu cầu cá nhân có thể khác.",
    ],
    [
      "Ghi nhật ký ăn uống hiệu quả",
      "Hướng dẫn",
      "Bắt đầu từ những bữa bạn nhớ rõ và cân nguyên liệu khi có thể.",
      "Phân biệt khối lượng sống và chín khi chọn thực phẩm. Nhập đúng gram hoặc khẩu phần. Thực đơn là kế hoạch, chỉ đánh dấu đã ăn khi bạn thực sự dùng bữa.",
    ],
  ];
  for (let i = 0; i < articles.length; i++) {
    const [title, category, excerpt, content] = articles[i];
    await db.article.upsert({
      where: { slug: `guide-${i}` },
      update: {},
      create: {
        slug: `guide-${i}`,
        title,
        category,
        excerpt,
        content,
        image: [images.salad, images.bowl, images.oats][i],
        published: true,
      },
    });
  }
  for (const u of [users[0], users[1]]) {
    const planId = "seed-week-" + u.id;
    if (!(await db.mealPlan.findUnique({ where: { id: planId } }))) {
      const p = await db.profile.findUniqueOrThrow({ where: { userId: u.id } }),
        g = await db.goal.findFirstOrThrow({
          where: { userId: u.id },
          orderBy: { createdAt: "desc" },
        });
      const eligible = recipes.filter((r) => isEligible(r, p));
      const items = fallbackSelection(eligible, 7, 4, g, 300000);
      await db.mealPlan.create({
        data: {
          id: planId,
          userId: u.id,
          name:
            u.role === "ADMIN"
              ? "Mẫu cân bằng 7 ngày"
              : "Tuần ăn ngon của Cường",
          startDate: today(),
          days: 7,
          mode: "fallback",
          isTemplate: u.role === "ADMIN",
          published: u.role === "ADMIN",
          explanation:
            "Kế hoạch mẫu được tính bằng thuật toán dự phòng từ nguyên liệu demo ước tính. Bạn có thể đổi món và khẩu phần.",
          goalSnapshot: {
            calories: g.calories,
            protein: g.protein,
            carbs: g.carbs,
            fat: g.fat,
          },
          items: {
            create: items.map((i) => {
              const r = eligible.find((r) => r.id === i.recipeId)!;
              return {
                recipeId: r.id,
                date: addDays(today(), i.day),
                meal: i.meal,
                servings: i.servings,
                snapshot: {
                  ...scale(r, 1),
                  name: r.name,
                  image: r.image,
                  cost: r.cost,
                },
              };
            }),
          },
        },
      });
    }
  }
  await db.setting.upsert({
    where: { key: "ai_enabled" },
    update: {},
    create: { key: "ai_enabled", value: true },
  });
  await db.setting.upsert({
    where: { key: "support_email" },
    update: {},
    create: { key: "support_email", value: "support@example.com" },
  });
  console.log(
    `Seed ready: ${await db.food.count()} foods, ${await db.recipe.count()} recipes, ${await db.user.count()} users. Demo: demo@nutriai.vn / admin@nutriai.vn. Password: NutriDemo123!`,
  );
}
main().finally(() => db.$disconnect());
