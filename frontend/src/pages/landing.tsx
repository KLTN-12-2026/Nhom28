import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Leaf,
  Menu,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  Utensils,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  ShoppingBasket,
  Heart,
  Sun,
  Moon,
  Apple,
  X,
  Play,
  CheckCheck,
} from "lucide-react";
import { Brand } from "../components/layout";
import { Button, Modal, Loading, ErrorState } from "../components/ui";
import { useData, number, money, mealNames } from "../lib/api";
import { AnimatedNumber, RecipeTile, Reveal } from "../components/experience";

const faqs = [
  [
    "NutriAI giúp tôi làm được những gì?",
    "Bạn có thể ghi lại bữa ăn và khẩu phần, đặt mục tiêu dinh dưỡng, xem biểu đồ tiến độ, lên thực đơn, tạo danh sách mua sắm và theo dõi nước uống. Mọi thay đổi được lưu trong không gian của bạn để có thể xem lại khi quay trở lại.",
  ],
  [
    "Tôi chưa biết nên bắt đầu từ đâu.",
    "Hãy tạo tài khoản và hoàn thành hồ sơ 7 bước. Sau đó chọn một mục tiêu tham khảo hoặc tự đặt mục tiêu, rồi thử ghi lại bữa ăn hôm nay. Bạn không cần biết hết mọi chỉ số để bắt đầu xây một thói quen nhỏ.",
  ],
  [
    "Không có OpenAI API key thì có dùng được không?",
    "Có. Tính năng theo dõi và quản lý thực đơn hoạt động độc lập với OpenAI. Khi chưa cấu hình API hoặc chưa đồng ý dùng AI, hệ thống gợi ý bằng thuật toán dự phòng và hiển thị rõ nguồn kết quả.",
  ],
  [
    "Các món ăn có phù hợp với người ăn chay hoặc có dị ứng?",
    "Hồ sơ cho phép chọn ăn chay, thuần chay và khai báo dị ứng. Hệ thống lọc công thức từ nguyên liệu trước khi gợi ý. Bạn vẫn cần đọc nhãn và kiểm tra thành phần thực tế, đặc biệt là nguy cơ nhiễm chéo khi chế biến.",
  ],
  [
    "Dữ liệu dinh dưỡng có phải đã được xác minh không?",
    "Bộ dữ liệu đi kèm hiện phục vụ trải nghiệm đồ án, có nhãn mô phỏng hoặc ước tính. Calories và macro của món được tính từ nguyên liệu trong kho. Khi dùng theo dõi thực tế, hãy đối chiếu nhãn sản phẩm hoặc nhập nguồn dữ liệu phù hợp của bạn.",
  ],
  [
    "Thực đơn đã lên có tự cộng vào calories hôm nay không?",
    "Không. Kế hoạch là lượng dự kiến. Chỉ khi bạn xác nhận Đã ăn hoặc ghi món vào nhật ký, năng lượng mới được cộng vào lượng đã nạp. Mỗi bữa trong kế hoạch có liên kết riêng để tránh ghi trùng khi bấm lại.",
  ],
  [
    "Thông tin của tôi có được gửi cho AI không?",
    "Chỉ khi bạn chủ động đồng ý trong hồ sơ và dịch vụ OpenAI đã được thiết lập, mục tiêu và danh sách món hợp lệ mới được gửi để tạo gợi ý. Tên và email không được gửi trong yêu cầu tạo thực đơn. Bạn có thể tắt lựa chọn này bất cứ lúc nào.",
  ],
  [
    "Tôi có thể tự thêm món ăn, thay món và xuất báo cáo không?",
    "Có. Bạn có thể tạo thực phẩm và công thức cá nhân, chỉnh nguyên liệu, khẩu phần và thời gian nấu. Trong kế hoạch, bạn có thể đổi món, chuyển ngày hoặc tạo lại bữa chưa ăn. Báo cáo dinh dưỡng hỗ trợ tải PDF và CSV.",
  ],
];
const featureStories = [
  {
    id: "plan",
    icon: Sparkles,
    title: "Một kế hoạch thật hợp với bạn.",
    tag: "LÊN THỰC ĐƠN",
    text: "Mục tiêu, chế độ ăn, dị ứng, ngân sách và thời gian nấu được đặt vào cùng một kế hoạch. Bạn chọn điều phù hợp; NutriAI giúp kết nối các bữa ăn.",
    bullets: [
      "Gợi ý cho 1, 3 hoặc 7 ngày",
      "Thay món và điều chỉnh khẩu phần",
      "Nguyên liệu, cách nấu và chi phí tham khảo",
    ],
    image: "ricebowl",
    label: "Từ câu hỏi “hôm nay ăn gì?”",
    number: "01",
  },
  {
    id: "diary",
    icon: BookOpen,
    title: "Hiểu bữa ăn, nhẹ nhàng từng chút.",
    tag: "NHẬT KÝ ĂN UỐNG",
    text: "Ghi món đã ăn, nhập gram hoặc khẩu phần, và xem cả ngày thay đổi theo từng bữa. Dữ liệu lịch sử được giữ lại để bạn nhìn thấy thói quen của chính mình.",
    bullets: [
      "Tìm món bằng tiếng Việt không dấu",
      "Calo và macro tính theo phần thực tế",
      "Sửa, xóa hoặc sao chép một ngày",
    ],
    image: "pho",
    label: "Mỗi bữa ăn, thêm một điều để hiểu",
    number: "02",
  },
  {
    id: "progress",
    icon: ChartNoAxesCombined,
    title: "Thấy rõ hành trình của chính mình.",
    tag: "THEO DÕI TIẾN ĐỘ",
    text: "Tổng kết năng lượng, các nhóm chất, cân nặng và số ngày ghi nhật ký trong một không gian. Quan sát xu hướng với đúng mục tiêu có hiệu lực ở từng ngày.",
    bullets: [
      "Biểu đồ 7, 30 hoặc 90 ngày",
      "Mục tiêu có lịch sử điều chỉnh",
      "Xuất báo cáo PDF và CSV",
    ],
    image: "vegetables",
    label: "Những thay đổi nhỏ xứng đáng được ghi nhận",
    number: "03",
  },
];
function SectionIntro({
  eyebrow,
  title,
  description,
  light = false,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  light?: boolean;
}) {
  return (
    <Reveal className={"editorial-section-intro " + (light ? "light" : "")}>
      <span className="new-eyebrow">
        <i />
        {eyebrow}
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
    </Reveal>
  );
}

export function Landing() {
  const q = useData("public-explore", "/public/explore"),
    data = q.data?.data;
  const [menu, setMenu] = useState(false),
    [story, setStory] = useState(0),
    [diet, setDiet] = useState("all"),
    [day, setDay] = useState(0),
    [portion, setPortion] = useState(1),
    [detail, setDetail] = useState<any>(null),
    [faq, setFaq] = useState<number | null>(0),
    [article, setArticle] = useState<any>(null);
  const reduced = useReducedMotion();
  const recipes = data?.recipes || [];
  const pool = useMemo(
    () =>
      recipes.filter((r: any) =>
        diet === "vegan"
          ? r.diet === "vegan"
          : diet === "protein"
            ? r.protein >= 20
            : diet === "quick"
              ? r.minutes <= 25
              : true,
      ),
    [recipes, diet],
  );
  const daily = useMemo(
    () =>
      ["breakfast", "lunch", "dinner", "snack"]
        .map((meal, index) => {
          const options = pool.filter((r: any) => r.mealType === meal);
          return {
            meal,
            recipe: options.length
              ? options[(day + index) % options.length]
              : pool[(day + index) % Math.max(1, pool.length)],
          };
        })
        .filter((i) => i.recipe),
    [pool, day],
  );
  const totals = daily.reduce(
    (s: any, i: any) => ({
      calories: s.calories + i.recipe.calories * portion,
      protein: s.protein + i.recipe.protein * portion,
      cost: s.cost + i.recipe.cost * portion,
      minutes: s.minutes + i.recipe.minutes,
    }),
    { calories: 0, protein: 0, cost: 0, minutes: 0 },
  );
  const current = featureStories[story];
  return (
    <div className="editorial-site" id="top">
      <div className="announcement">
        <span className="announcement-dot" />
        Ăn uống có chủ đích. Sống theo nhịp của bạn.
        <a href="#experience">
          Thử khám phá một thực đơn <ArrowRight size={13} />
        </a>
      </div>
      <header className="new-nav">
        <div className="new-nav-inner">
          <Brand />
          <nav className={menu ? "new-links is-open" : "new-links"}>
            <a href="#features" onClick={() => setMenu(false)}>
              Tại sao NutriAI?
            </a>
            <a href="#experience" onClick={() => setMenu(false)}>
              Khám phá thực đơn
            </a>
            <a href="#knowledge" onClick={() => setMenu(false)}>
              Góc kiến thức
            </a>
            <a href="#faq" onClick={() => setMenu(false)}>
              Giải đáp
            </a>
          </nav>
          <div className="new-nav-actions">
            <Link className="new-login" to="/login">
              Đăng nhập
            </Link>
            <Link className="new-button dark small" to="/register">
              Bắt đầu miễn phí <ArrowUpRight size={17} />
            </Link>
            <button
              className="new-menu-button"
              aria-label={menu ? "Đóng điều hướng" : "Mở điều hướng"}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main>
        <section className="new-hero new-container">
          <div className="hero-editorial-copy">
            <motion.div
              className="hero-availability"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span>
                <Sparkles size={13} />
              </span>
              DINH DƯỠNG DÀNH RIÊNG CHO BẠN
            </motion.div>
            <motion.h1
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.75 }}
            >
              Ăn uống tốt hơn.{" "}
              <span>
                Sống trọn vẹn hơn.
                <svg viewBox="0 0 430 18" aria-hidden="true">
                  <path
                    d="M4 13C91 1 301 1 426 8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.7 }}
            >
              Một bữa ăn ngon. Một thói quen tốt.
              <br />
              Cùng NutriAI biến những điều nhỏ mỗi ngày thành một hành trình
              dinh dưỡng thật <strong>hợp với bạn.</strong>
            </motion.p>
            <div className="new-hero-actions">
              <Link className="new-button dark" to="/register">
                Bắt đầu hành trình của bạn <ArrowUpRight size={19} />
              </Link>
              <a className="new-play-link" href="#experience">
                <span>
                  <Play size={13} fill="currentColor" />
                </span>
                Khám phá trước
              </a>
            </div>
            <div className="hero-value-notes">
              <span>
                <Check size={14} />
                Bắt đầu miễn phí
              </span>
              <span>
                <Check size={14} />
                Không cần thẻ thanh toán
              </span>
            </div>
            <div className="hero-editorial-footer">
              <div className="tiny-bowl">
                <Utensils size={22} />
              </div>
              <div>
                <strong>Bếp Việt. Nhịp sống hiện đại.</strong>
                <span>Nguyên liệu quen thuộc, lựa chọn có chủ đích.</span>
              </div>
            </div>
          </div>
          <motion.div
            className="hero-food-scene"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
          >
            <div className="hero-scene-circle" />
            <div className="hero-dashed-orbit" />
            <motion.div
              className="hero-image-circle"
              animate={reduced ? {} : { rotate: [-3, 1, -3] }}
              transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            >
              <img
                src="/images/bowl.jpg"
                alt="Bát rau củ tươi nhiều màu sắc, gợi cảm hứng cho một bữa ăn cân bằng"
                fetchPriority="high"
              />
            </motion.div>
            <span className="floating-ingredient ingredient-one">
              <img src="/images/avocado.jpg" alt="" />
            </span>
            <span className="floating-ingredient ingredient-two">
              <img src="/images/berries.jpg" alt="" />
            </span>
            <motion.div
              className="hero-smart-label"
              animate={reduced ? {} : { y: [0, -9, 0] }}
              transition={{ duration: 5, repeat: Infinity }}
            >
              <span>
                <Sparkles size={21} />
              </span>
              <div>
                <small>MỘT CHÚT THÔNG MINH</small>
                <strong>Thực đơn đúng gu bạn</strong>
                <p>Từ mục tiêu đến từng nguyên liệu</p>
              </div>
              <Check size={17} />
            </motion.div>
            <motion.button
              className="hero-day-card"
              onClick={() =>
                document
                  .getElementById("experience")
                  ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" })
              }
              animate={reduced ? {} : { y: [0, 7, 0] }}
              transition={{ duration: 6, repeat: Infinity }}
            >
              <div className="hero-day-card-title">
                <span className="new-icon-box">
                  <Leaf size={19} />
                </span>
                <div>
                  <small>THÓI QUEN NHỎ</small>
                  <strong>Một ngày thật cân bằng</strong>
                </div>
                <ArrowUpRight size={18} />
              </div>
              <div className="hero-day-mini-macros">
                <span>
                  <i />
                  Protein
                </span>
                <span>
                  <i />
                  Carbs
                </span>
                <span>
                  <i />
                  Chất béo
                </span>
              </div>
              <div className="hero-day-card-bottom">
                <span>Khám phá thực đơn mẫu</span>
                <span>
                  Thử ngay <ArrowRight size={12} />
                </span>
              </div>
            </motion.button>
            <span className="hero-handwritten">
              a little better,
              <br />
              every day.
            </span>
            <div className="hero-diet-sticker">
              <Leaf size={19} />
              <span>
                ĂN NGON
                <br />
                <b>SỐNG KHỎE</b>
              </span>
            </div>
          </motion.div>
        </section>
        <section className="new-stats-wrap">
          <div className="new-container new-stats">
            <div className="stats-intro">
              <span className="new-eyebrow">
                KHÔNG GIAN CỦA NHỮNG LỰA CHỌN TỐT
              </span>
              <p>
                Mở ra nhiều cảm hứng
                <br />
                cho căn bếp của bạn.
              </p>
            </div>
            {[
              [data?.stats.foods, "thực phẩm trong kho"],
              [data?.stats.recipes, "công thức món ăn"],
              [data?.stats.templates, "thực đơn tham khảo"],
            ].map(([n, label], i) => (
              <div className="new-stat" key={i}>
                <strong>
                  {typeof n === "number" ? (
                    <AnimatedNumber value={n} />
                  ) : (
                    <span className="stat-loading">···</span>
                  )}
                  <sup>+</sup>
                </strong>
                <span>{label}</span>
              </div>
            ))}
            <span className="stats-source">
              Kho dữ liệu demo có nhãn ước tính.
              <br />
              Số lượng cập nhật từ hệ thống.
            </span>
          </div>
        </section>
        <section id="features" className="new-section new-container">
          <SectionIntro
            eyebrow="THÓI QUEN TỐT, TỪ NHỮNG ĐIỀU NHỎ"
            title={
              <>
                Chăm sóc dinh dưỡng,
                <br />
                theo cách nhẹ nhàng hơn.
              </>
            }
            description="Bớt đoán mò. Bớt rối rắm. Có một nơi để hiểu bữa ăn, chuẩn bị kế hoạch và nhìn thấy từng bước tiến của bạn."
          />
          <div className="new-feature-layout">
            <div
              className="feature-story-tabs"
              role="tablist"
              aria-label="Khám phá tính năng"
            >
              {featureStories.map((f, i) => (
                <button
                  key={f.id}
                  className={
                    story === i
                      ? "feature-story-tab active"
                      : "feature-story-tab"
                  }
                  role="tab"
                  aria-selected={story === i}
                  aria-controls={"feature-panel-" + f.id}
                  onClick={() => setStory(i)}
                >
                  <span className="feature-tab-number">{f.number}</span>
                  <div>
                    <small>{f.tag}</small>
                    <h3>{f.title}</h3>
                    {story === i && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                      >
                        {f.text}
                      </motion.p>
                    )}
                  </div>
                  <ArrowUpRight size={20} />
                </button>
              ))}
              <Link to="/login" className="new-text-link">
                Trải nghiệm tài khoản demo <ArrowRight size={17} />
              </Link>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                className="feature-story-visual"
                id={"feature-panel-" + current.id}
                role="tabpanel"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <div className="feature-story-photo">
                  <img
                    src={"/images/" + current.image + ".jpg"}
                    alt={current.title}
                  />
                  <span>ĐƯỢC THIẾT KẾ CHO CUỘC SỐNG THỰC</span>
                </div>
                <div className="feature-story-note">
                  <span className="new-icon-box">
                    <current.icon size={24} />
                  </span>
                  <div>
                    <small>{current.tag}</small>
                    <h3>{current.label}</h3>
                    <ul>
                      {current.bullets.map((b) => (
                        <li key={b}>
                          <Check size={14} />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <span className="feature-story-corner">
                  Một nơi.
                  <br />
                  <b>Nhiều điều tốt hơn.</b>
                  <Leaf size={28} />
                </span>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="feature-detail-strip">
            {[
              [
                ShieldCheck,
                "Riêng tư từ thiết kế",
                "Bạn kiểm soát dữ liệu và quyền sử dụng AI.",
              ],
              [
                ShoppingBasket,
                "Đi chợ có kế hoạch",
                "Gộp nguyên liệu từ những món bạn đã chọn.",
              ],
              [
                Heart,
                "Theo nhịp của riêng bạn",
                "Tự điều chỉnh mục tiêu, món ăn và khẩu phần.",
              ],
            ].map(([I, title, text], i) => {
              const Icon = I as typeof Leaf;
              return (
                <div key={i}>
                  <Icon size={24} />
                  <div>
                    <h3>{title as string}</h3>
                    <p>{text as string}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <section id="experience" className="experience-section">
          <div className="new-container">
            <div className="experience-heading">
              <SectionIntro
                light
                eyebrow="CHẠM THỬ MỘT NGÀY MỚI"
                title={
                  <>
                    Một ngày ăn ngon,
                    <br />
                    <em>trông như thế nào?</em>
                  </>
                }
                description="Chọn phong cách bạn thích, xem các bữa thay đổi và mở công thức để khám phá. Một trải nghiệm nhỏ trước khi tạo kế hoạch của riêng bạn."
              />
              <div className="experience-note">
                <span>
                  <Sparkles size={22} />
                </span>
                <p>
                  Bản xem thử dùng công thức trong kho.
                  <br />
                  <b>Chưa phải thực đơn cá nhân hóa.</b>
                </p>
              </div>
            </div>
            <div className="experience-controls">
              <div
                className="experience-filters"
                aria-label="Phong cách thực đơn"
              >
                {[
                  ["all", "Ăn đa dạng", Utensils],
                  ["vegan", "Thuần chay", Leaf],
                  ["protein", "Ưu tiên protein", Target],
                  ["quick", "Nhanh gọn", Clock],
                ].map(([key, label, I]) => {
                  const Icon = I as typeof Leaf;
                  return (
                    <button
                      key={key as string}
                      aria-pressed={diet === key}
                      className={diet === key ? "active" : ""}
                      onClick={() => {
                        setDiet(key as string);
                        setDay(0);
                      }}
                    >
                      <Icon size={16} />
                      {label as string}
                    </button>
                  );
                })}
              </div>
              <button
                className="change-day"
                onClick={() => setDay((d) => d + 1)}
              >
                Đổi cảm hứng <ArrowRight size={17} />
              </button>
            </div>
            {q.isPending ? (
              <Loading />
            ) : q.error ? (
              <ErrorState error={q.error} retry={() => q.refetch()} />
            ) : (
              <>
                <div className="day-experience-grid">
                  {daily.map(({ meal, recipe }: any, i: number) => (
                    <motion.button
                      key={meal + "-" + recipe.id}
                      className="day-experience-meal"
                      onClick={() => setDetail(recipe)}
                      initial={{ opacity: 0.5, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                    >
                      <div className="day-experience-image">
                        <img
                          src={recipe.image}
                          alt={recipe.name}
                          loading="lazy"
                        />
                        <span>
                          {["☀", "◒", "☾", "✦"][i]} {mealNames[meal]}
                        </span>
                        <i>
                          <ArrowUpRight size={19} />
                        </i>
                      </div>
                      <div className="day-experience-copy">
                        <small>
                          {recipe.minutes} PHÚT · {portion} KHẨU PHẦN
                        </small>
                        <h3>{recipe.name}</h3>
                        <span>
                          <Flame size={14} />
                          {number(recipe.calories * portion)} kcal <i />{" "}
                          {number(recipe.protein * portion)}g protein
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>
                <div className="experience-summary">
                  <div>
                    <span>TỔNG QUAN NGÀY XEM THỬ</span>
                    <div>
                      <strong>
                        {number(totals.calories)} <small>kcal</small>
                      </strong>
                      <strong>
                        {number(totals.protein)} <small>g protein</small>
                      </strong>
                      <strong>
                        {money(totals.cost)}
                        <small>ước tính</small>
                      </strong>
                    </div>
                  </div>
                  <label className="portion-slider">
                    Thử điều chỉnh khẩu phần{" "}
                    <span>
                      <input
                        aria-label="Khẩu phần xem thử"
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.25"
                        value={portion}
                        onChange={(e) => setPortion(Number(e.target.value))}
                      />
                      <b>×{portion}</b>
                    </span>
                  </label>
                  <Link to="/register" className="new-button lime">
                    Tạo kế hoạch của tôi <ArrowUpRight size={18} />
                  </Link>
                </div>
              </>
            )}
            <p className="experience-disclaimer">
              Bạn có thể bấm vào từng món để xem nguyên liệu và cách nấu. Dinh
              dưỡng và giá là dữ liệu demo ước tính; điều chỉnh theo mục tiêu cá
              nhân khi đăng nhập.
            </p>
          </div>
        </section>
        <section className="new-section new-container recipe-editorial-section">
          <div className="section-split-heading">
            <SectionIntro
              eyebrow="CĂN BẾP NHỎ, NHIỀU CẢM HỨNG"
              title={
                <>
                  Món quen thuộc.
                  <br />
                  Một chút mới mẻ.
                </>
              }
              description="Có những bữa ăn ngon không cần phức tạp. Khám phá công thức ghi rõ nguyên liệu, khẩu phần và từng bước chuẩn bị."
            />
            <Link to="/app/recipes" className="new-button outline">
              Khám phá thư viện <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="new-recipe-grid">
            {recipes.slice(0, 6).map((r: any, i: number) => (
              <Reveal key={r.id} delay={i * 0.03}>
                <RecipeTile publicView recipe={r} onSelect={setDetail} />
              </Reveal>
            ))}
          </div>
          <div className="recipe-editorial-note">
            <Leaf size={18} />
            <p>
              Ăn chay, món Việt, nhanh gọn hay ưu tiên protein — một lựa chọn
              vừa với bạn luôn đáng để khám phá.
            </p>
          </div>
        </section>
        <section className="new-how-section new-container" id="how">
          <div className="how-photo">
            <img
              src="/images/kitchen.jpg"
              alt="Chuẩn bị nguyên liệu trong căn bếp gia đình"
              loading="lazy"
            />
            <div>
              <span>KHÔNG CẦN HOÀN HẢO.</span>
              <h3>
                Chỉ cần bắt đầu
                <br />
                từ bữa ăn tiếp theo.
              </h3>
              <Leaf size={34} />
            </div>
            <span className="how-photo-sticker">
              <CheckCheck size={22} />
              Một chút mỗi ngày.
            </span>
          </div>
          <div className="how-editorial-copy">
            <span className="new-eyebrow">
              <i />
              DỄ BẮT ĐẦU. DỄ DUY TRÌ.
            </span>
            <h2>
              Từ “mình nên…”
              <br />
              đến “mình đã làm”.
            </h2>
            <p>
              Không cần thay đổi mọi thứ trong một ngày. NutriAI giúp bạn bắt
              đầu từ những việc có thể làm ngay.
            </p>
            <div className="how-step-list">
              {[
                [
                  "Làm quen với chính mình",
                  "Tạo hồ sơ, chia sẻ sở thích, chế độ ăn và các món bạn muốn tránh.",
                ],
                [
                  "Chọn một mục tiêu vừa sức",
                  "Xem các chỉ số tham khảo hoặc tự điều chỉnh mục tiêu phù hợp với bạn.",
                ],
                [
                  "Khám phá, ghi lại và điều chỉnh",
                  "Lên kế hoạch, thử món mới, ghi những gì đã ăn và quan sát tiến độ qua từng tuần.",
                ],
              ].map(([title, text], i) => (
                <Reveal className="how-step" key={title} delay={i * 0.08}>
                  <span>0{i + 1}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Link to="/register" className="new-text-link">
              Bắt đầu hành trình của bạn <ArrowRight size={18} />
            </Link>
          </div>
        </section>
        <section id="knowledge" className="new-section new-container">
          <div className="section-split-heading">
            <SectionIntro
              eyebrow="HIỂU THÊM, CHĂM SÓC TỐT HƠN"
              title={
                <>
                  Một chút kiến thức.
                  <br />
                  Nhiều lựa chọn tự tin.
                </>
              }
              description="Đọc vừa đủ để thực hành: cách ghi nhật ký, chuẩn bị bữa ăn và hiểu những con số mà bạn đang theo dõi."
            />
            <Link className="new-button outline" to="/app/articles">
              Ghé góc kiến thức <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="new-article-grid">
            {data?.articles.slice(0, 3).map((a: any, i: number) => (
              <Reveal key={a.id} delay={i * 0.08}>
                <button
                  className="new-article-card"
                  onClick={() => setArticle(a)}
                >
                  <div>
                    <img src={a.image} alt={a.title} loading="lazy" />
                    <span>
                      <ArrowUpRight size={23} />
                    </span>
                  </div>
                  <small>
                    {a.category.toUpperCase()} <i />{" "}
                    {Math.max(
                      3,
                      Math.ceil(a.content.split(/\s+/).length / 190),
                    )}{" "}
                    PHÚT ĐỌC
                  </small>
                  <h3>{a.title}</h3>
                  <p>{a.excerpt}</p>
                  <b>
                    Đọc câu chuyện <ArrowRight size={16} />
                  </b>
                </button>
              </Reveal>
            ))}
          </div>
        </section>
        <section id="faq" className="new-faq-section">
          <div className="new-container faq-layout">
            <div>
              <span className="new-eyebrow">
                <i />
                BẠN CÓ THỂ ĐANG TÒ MÒ
              </span>
              <h2>
                Mọi câu hỏi đều
                <br />
                là một khởi đầu tốt.
              </h2>
              <p>
                Hiểu rõ cách ứng dụng hoạt động để bắt đầu theo cách thoải mái
                nhất.
              </p>
              <div className="faq-promise">
                <ShieldCheck size={26} />
                <div>
                  <strong>Rõ ràng ngay từ đầu.</strong>
                  <span>
                    Quyền riêng tư, nguồn dữ liệu và cách sử dụng AI đều được
                    giải thích công khai.
                  </span>
                </div>
              </div>
              <Link to="/privacy" className="new-text-link">
                Chính sách quyền riêng tư <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="faq-list">
              {faqs.map(([question, answer], i) => (
                <div
                  key={question}
                  className={faq === i ? "faq-item open" : "faq-item"}
                >
                  <button
                    aria-expanded={faq === i}
                    aria-controls={"faq-answer-" + i}
                    onClick={() => setFaq(faq === i ? null : i)}
                  >
                    <span>{question}</span>
                    <Plus size={20} />
                  </button>
                  <AnimatePresence initial={false}>
                    {faq === i && (
                      <motion.div
                        id={"faq-answer-" + i}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        <p>{answer}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="new-final-cta new-container">
          <div className="cta-decoration">✳</div>
          <span className="new-eyebrow">
            HÀNH TRÌNH TỐT HƠN, BẮT ĐẦU TỪ BẠN
          </span>
          <h2>
            Thêm một bữa ăn ngon.
            <br />
            Thêm một ngày yêu mình.
          </h2>
          <p>
            Một không gian để chăm sóc dinh dưỡng theo nhịp sống của bạn.
            <br />
            Bắt đầu nhỏ thôi. Chúng mình cùng đi tiếp.
          </p>
          <div>
            <Link to="/register" className="new-button dark">
              Tạo tài khoản miễn phí <ArrowUpRight size={18} />
            </Link>
            <Link to="/login" className="new-text-link">
              Khám phá bản demo <ArrowRight size={17} />
            </Link>
          </div>
          <span className="cta-leaf">
            <Leaf size={56} />
          </span>
        </section>
      </main>
      <footer className="new-footer">
        <div className="new-container">
          <div className="new-footer-top">
            <div>
              <Brand />
              <p>
                Ăn uống có chủ đích.
                <br />
                Sống trọn vẹn theo cách của bạn.
              </p>
              <span className="footer-project-note">
                Không gian dinh dưỡng cá nhân
                <br />
                Một thói quen nhỏ. Mỗi ngày tốt hơn.
              </span>
            </div>
            <div>
              <h4>KHÁM PHÁ</h4>
              <a href="#features">Tính năng của NutriAI</a>
              <a href="#experience">Trải nghiệm thực đơn</a>
              <Link to="/app/recipes">Thư viện công thức</Link>
              <Link to="/app/articles">Góc kiến thức</Link>
            </div>
            <div>
              <h4>KHÔNG GIAN CỦA BẠN</h4>
              <Link to="/register">Bắt đầu miễn phí</Link>
              <Link to="/login">Đăng nhập</Link>
              <Link to="/app">Tổng quan dinh dưỡng</Link>
              <Link to="/app/planner">Kế hoạch bữa ăn</Link>
            </div>
            <div className="footer-transparency">
              <span>
                <ShieldCheck size={20} />
                Một ghi chú chân thành
              </span>
              <p>
                NutriAI hỗ trợ theo dõi dinh dưỡng phổ thông. Dữ liệu đi kèm là
                demo/ước tính; thông tin không thay thế tư vấn y tế cá nhân.
              </p>
              <a href="#faq">
                Tìm hiểu cách hoạt động <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
          <div className="new-footer-bottom">
            <span>© 2026 NutriAI. Mỗi ngày tốt hơn một chút.</span>
            <div>
              <Link to="/privacy">Quyền riêng tư</Link>
              <Link to="/terms">Điều khoản sử dụng</Link>
              <a href="#top">Về đầu trang ↑</a>
            </div>
          </div>
        </div>
      </footer>
      <Modal
        open={!!detail}
        title={detail?.name || "Chi tiết công thức"}
        onClose={() => setDetail(null)}
        wide
      >
        {detail && (
          <div className="public-recipe-detail">
            <img src={detail.image} alt={detail.name} />
            <div className="public-recipe-body">
              <span className="badge">
                {detail.minutes} phút · 1 khẩu phần · Dữ liệu ước tính
              </span>
              <p>{detail.description}</p>
              <div className="nutrition-facts">
                {[
                  ["calories", "kcal"],
                  ["protein", "g protein"],
                  ["carbs", "g carbs"],
                  ["fat", "g chất béo"],
                ].map(([k, u]) => (
                  <span key={k}>
                    <strong>{number(detail[k])}</strong>
                    {u}
                  </span>
                ))}
              </div>
              <h3>Nguyên liệu cho 1 khẩu phần</h3>
              {detail.ingredients.map((i: any) => (
                <div className="ingredient-row" key={i.id}>
                  <span>{i.food.name}</span>
                  <strong>{number(i.grams / detail.servings)}g</strong>
                </div>
              ))}
              <h3>Cách chuẩn bị</h3>
              <ol className="recipe-steps">
                {detail.steps.map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <div className="notice">
                Dị ứng đã khai báo:{" "}
                {detail.allergens.join(", ") || "Chưa có nhãn"}. Kiểm tra thành
                phần thực tế trước khi nấu.
              </div>
              <Link
                className="new-button dark"
                to="/register"
                onClick={() => setDetail(null)}
              >
                Lưu vào không gian của tôi <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        open={!!article}
        title={article?.title || "Góc kiến thức"}
        onClose={() => setArticle(null)}
        wide
      >
        {article && (
          <div className="public-article-detail">
            <img src={article.image} alt="" />
            <span className="badge">{article.category}</span>
            <p className="article-excerpt">{article.excerpt}</p>
            {article.content.split("\n\n").map((part: string, i: number) => {
              const [heading, ...body] = part.split("\n");
              return heading.startsWith("## ") ? (
                <section key={i}>
                  <h3>{heading.slice(3)}</h3>
                  <p>{body.join("\n")}</p>
                </section>
              ) : (
                <p key={i}>{part}</p>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}
