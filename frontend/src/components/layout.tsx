import { useState, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import {
  NavLink,
  Link,
  Outlet,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  Utensils,
  CalendarDays,
  Sparkles,
  ShoppingBasket,
  ChartNoAxesCombined,
  Scale,
  Settings,
  LogOut,
  Leaf,
  ChevronRight,
  Search,
  Bell,
  Menu,
  X,
  Heart,
  Users,
  ShieldCheck,
  FolderTree,
  MessagesSquare,
  ScrollText,
  SlidersHorizontal,
  MessageCircle,
  ArrowUpRight,
} from "lucide-react";
import { useAuth, useData } from "../lib/api";
import { Button, Modal, Loading } from "./ui";
const AssistantPanel = lazy(() =>
  import("../pages/misc").then((m) => ({ default: m.Assistant })),
);
export function Brand() {
  return (
    <Link to="/" className="brand">
      <span className="brand-mark">
        <Leaf size={24} strokeWidth={2.5} />
      </span>
      <span>
        nutri<span className="brand-ai">ai</span>
        <i />
      </span>
    </Link>
  );
}
const nav = [
  ["/app", "Tổng quan", LayoutDashboard],
  ["/app/diary", "Nhật ký ăn uống", BookOpen],
  ["/app/planner", "Kế hoạch bữa ăn", CalendarDays],
  ["/app/templates", "Thực đơn mẫu", CalendarDays],
  ["/app/ai", "Gợi ý thực đơn AI", Sparkles],
  ["/app/foods", "Kho thực phẩm", Utensils],
  ["/app/recipes", "Công thức món ăn", BookOpen],
  ["/app/shopping", "Danh sách mua sắm", ShoppingBasket],
  ["/app/analytics", "Phân tích dinh dưỡng", ChartNoAxesCombined],
  ["/app/measurements", "Chỉ số cơ thể", Scale],
  ["/app/articles", "Góc kiến thức", Leaf],
] as const;
const adminNav = [
  ["/admin", "Tổng quan hệ thống", LayoutDashboard],
  ["/admin/users", "Người dùng", Users],
  ["/admin/foods", "Quản lý thực phẩm", Utensils],
  ["/admin/recipes", "Quản lý công thức", BookOpen],
  ["/admin/categories", "Danh mục", FolderTree],
  ["/admin/plans", "Thực đơn & mẫu", CalendarDays],
  ["/admin/articles", "Nội dung kiến thức", ScrollText],
  ["/admin/feedback", "Phản hồi", MessagesSquare],
  ["/admin/ai", "Yêu cầu AI", Sparkles],
  ["/admin/audit", "Nhật ký kiểm toán", ShieldCheck],
  ["/admin/settings", "Cài đặt hệ thống", SlidersHorizontal],
] as const;
export function Layout({ admin = false }: { admin?: boolean }) {
  const { user, logout } = useAuth(),
    [mobile, setMobile] = useState(false),
    [chat, setChat] = useState(false),
    [search, setSearch] = useState(""),
    navigate = useNavigate(),
    location = useLocation();
  const { data } = useData("notifications", "/notifications");
  const unread = data?.data?.filter((n: any) => !n.read).length || 0;
  const items = admin ? adminNav : nav;
  const current =
    items.find((n) => n[0] === location.pathname)?.[1] || "Không gian cá nhân";
  return (
    <div className={admin ? "app-shell admin-shell" : "app-shell"}>
      {mobile && (
        <div className="sidebar-overlay" onClick={() => setMobile(false)} />
      )}
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="mobile-only icon-button"
            onClick={() => setMobile(false)}
            aria-label="Đóng menu"
          >
            <X />
          </button>
        </div>
        <div className="workspace-label">
          <span className="status-dot" />
          {admin ? "KHÔNG GIAN QUẢN TRỊ" : "KHÔNG GIAN SỨC KHỎE"}
        </div>
        <div className="nav-label">
          {admin ? "QUẢN LÝ HỆ THỐNG" : "KHÁM PHÁ MỖI NGÀY"}
        </div>
        <nav>
          {items.map(([href, label, Icon]) => (
            <NavLink
              key={href}
              to={href}
              end={href === "/app" || href === "/admin"}
              onClick={() => setMobile(false)}
              className={({ isActive }) =>
                isActive ? "nav-item active" : "nav-item"
              }
            >
              <Icon size={19} />
              <span>{label}</span>
              {href.endsWith("/ai") && <span className="tiny-label">AI</span>}
            </NavLink>
          ))}
        </nav>
        {!admin && (
          <div className="sidebar-tip">
            <span className="tip-icon">
              <Sparkles size={22} />
            </span>
            <h4>Ăn ngon. Sống khỏe.</h4>
            <p>Một kế hoạch phù hợp, một phiên bản tốt hơn của bạn.</p>
            <Link to="/app/ai">
              Khám phá cùng AI <ArrowUpRight size={15} />
            </Link>
          </div>
        )}
        <div className="sidebar-bottom">
          {user?.role === "ADMIN" && (
            <Link to={admin ? "/app" : "/admin"} className="nav-item">
              <ShieldCheck size={18} />
              {admin ? "Về ứng dụng" : "Trang quản trị"}
            </Link>
          )}
          <Link to="/app/settings" className="nav-item">
            <Settings size={18} />
            Cài đặt tài khoản
          </Link>
          <button
            onClick={() => logout().then(() => navigate("/login"))}
            className="nav-item"
          >
            <LogOut size={18} />
            Đăng xuất
          </button>
          <div className="sidebar-user">
            <div className="avatar">
              {user?.avatar ? (
                <img src={user.avatar} alt="" />
              ) : (
                user?.name?.split(" ").slice(-1)[0]?.slice(0, 1)
              )}
            </div>
            <div>
              <strong>{user?.name}</strong>
              <small>{admin ? "Quản trị viên" : "Tài khoản cá nhân"}</small>
            </div>
            <ChevronRight size={16} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-only icon-button"
              aria-label="Mở menu"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </button>
            <span>{admin ? "Quản trị" : "Không gian của bạn"}</span>
            <ChevronRight size={13} />
            <strong>{current}</strong>
          </div>
          <div className="topbar-actions">
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate("/app/foods?q=" + encodeURIComponent(search));
              }}
            >
              <Search size={17} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm thực phẩm, món ăn…"
                aria-label="Tìm kiếm thực phẩm"
              />
              <kbd>↵</kbd>
            </form>
            <Link
              to="/app/notifications"
              className="notification-button icon-button"
              aria-label="Thông báo"
            >
              <Bell size={20} />
              {unread > 0 && <i />}
            </Link>
            <Link to="/app/profile" className="avatar small">
              {user?.name
                ?.split(" ")
                .slice(-2)
                .map((part: string) => part[0])
                .join("")}
            </Link>
          </div>
        </header>
        <motion.main
          key={location.pathname}
          className="main-content"
          initial={{ opacity: 0.9, y: 9 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <Outlet />
        </motion.main>
        <footer className="app-footer">
          <span>© 2026 NutriAI · Mỗi ngày tốt hơn một chút.</span>
          <span>Dữ liệu dinh dưỡng chỉ mang tính tham khảo.</span>
        </footer>
      </div>
      {!admin && (
        <button
          className="floating-assistant"
          onClick={() => setChat(true)}
          aria-label="Mở trợ lý dinh dưỡng"
        >
          <MessageCircle size={24} />
          <span>Hỏi NutriAI</span>
          <span className="status-dot" />
        </button>
      )}
      {!admin && (
        <Modal
          open={chat}
          onClose={() => setChat(false)}
          title="Trợ lý NutriAI"
          drawer
        >
          <Link
            className="text-link"
            to="/app/assistant"
            onClick={() => setChat(false)}
          >
            Mở trang hội thoại <ArrowUpRight size={15} />
          </Link>
          <Suspense fallback={<Loading />}>
            <AssistantPanel embedded />
          </Suspense>
        </Modal>
      )}
    </div>
  );
}
