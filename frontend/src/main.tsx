import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  Link,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { MotionConfig } from "framer-motion";
import { AuthProvider, useAuth } from "./lib/api";
import { Layout } from "./components/layout";
import { Loading, Empty, Button } from "./components/ui";
const Landing = lazy(() =>
    import("./pages/landing").then((m) => ({ default: m.Landing })),
  ),
  AuthPage = lazy(() =>
    import("./pages/public").then((m) => ({ default: m.AuthPage })),
  ),
  Legal = lazy(() =>
    import("./pages/public").then((m) => ({ default: m.Legal })),
  );
const Dashboard = lazy(() =>
    import("./pages/dashboard").then((m) => ({ default: m.Dashboard })),
  ),
  Diary = lazy(() =>
    import("./pages/diary").then((m) => ({ default: m.Diary })),
  );
const Profile = lazy(() =>
    import("./pages/profile").then((m) => ({ default: m.Profile })),
  ),
  Goals = lazy(() =>
    import("./pages/profile").then((m) => ({ default: m.Goals })),
  ),
  Settings = lazy(() =>
    import("./pages/profile").then((m) => ({ default: m.Settings })),
  );
const Catalog = lazy(() =>
    import("./pages/catalog").then((m) => ({ default: m.Catalog })),
  ),
  CatalogDetail = lazy(() =>
    import("./pages/catalog").then((m) => ({ default: m.CatalogDetail })),
  );
const AiPlanner = lazy(() =>
    import("./pages/planner").then((m) => ({ default: m.AiPlanner })),
  ),
  Planner = lazy(() =>
    import("./pages/planner").then((m) => ({ default: m.Planner })),
  ),
  Shopping = lazy(() =>
    import("./pages/planner").then((m) => ({ default: m.Shopping })),
  );
const Analytics = lazy(() =>
    import("./pages/analytics").then((m) => ({ default: m.Analytics })),
  ),
  Measurements = lazy(() =>
    import("./pages/analytics").then((m) => ({ default: m.Measurements })),
  );
const Assistant = lazy(() =>
    import("./pages/misc").then((m) => ({ default: m.Assistant })),
  ),
  Articles = lazy(() =>
    import("./pages/misc").then((m) => ({ default: m.Articles })),
  ),
  ArticleDetail = lazy(() =>
    import("./pages/misc").then((m) => ({ default: m.ArticleDetail })),
  ),
  Notifications = lazy(() =>
    import("./pages/misc").then((m) => ({ default: m.Notifications })),
  );
const AdminDashboard = lazy(() =>
    import("./pages/admin").then((m) => ({ default: m.AdminDashboard })),
  ),
  AdminResource = lazy(() =>
    import("./pages/admin").then((m) => ({ default: m.AdminResource })),
  ),
  AdminSettings = lazy(() =>
    import("./pages/admin").then((m) => ({ default: m.AdminSettings })),
  );
const Templates = lazy(() =>
  import("./pages/templates").then((m) => ({ default: m.Templates })),
);
import "./styles.css";
import "./editorial.css";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15000, refetchOnWindowFocus: false },
  },
});
function Guard({ admin = false }: { admin?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "ADMIN") return <Navigate to="/app" replace />;
  return <Outlet />;
}
function DashboardEntry() {
  const { user } = useAuth();
  return user?.profile && !user.profile.onboarded ? (
    <Navigate to="/app/onboarding" replace />
  ) : (
    <Dashboard />
  );
}
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <Empty
        title="Có lỗi hiển thị"
        text="Tải lại ứng dụng để kết nối lại dữ liệu."
      >
        <Button onClick={() => location.reload()}>Tải lại</Button>
      </Empty>
    ) : (
      this.props.children
    );
  }
}
function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage kind="register" />} />
      <Route path="/forgot-password" element={<AuthPage kind="forgot" />} />
      <Route path="/reset-password" element={<AuthPage kind="reset" />} />
      <Route path="/privacy" element={<Legal privacy />} />
      <Route path="/terms" element={<Legal />} />
      <Route element={<Guard />}>
        <Route path="/app" element={<Layout />}>
          <Route index element={<DashboardEntry />} />
          <Route path="onboarding" element={<Profile onboarding />} />
          <Route path="profile" element={<Profile />} />
          <Route path="goals" element={<Goals />} />
          <Route path="settings" element={<Settings />} />
          <Route path="diary" element={<Diary />} />
          <Route path="foods" element={<Catalog />} />
          <Route path="foods/:id" element={<CatalogDetail />} />
          <Route path="recipes" element={<Catalog kind="recipes" />} />
          <Route
            path="recipes/:id"
            element={<CatalogDetail kind="recipes" />}
          />
          <Route path="planner" element={<Planner />} />
          <Route path="templates" element={<Templates />} />
          <Route path="ai" element={<AiPlanner />} />
          <Route path="shopping" element={<Shopping />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="measurements" element={<Measurements />} />
          <Route path="assistant" element={<Assistant />} />
          <Route path="articles" element={<Articles />} />
          <Route path="articles/:id" element={<ArticleDetail />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
      </Route>
      <Route element={<Guard admin />}>
        <Route path="/admin" element={<Layout admin />}>
          <Route index element={<AdminDashboard />} />
          <Route path="foods" element={<Catalog admin />} />
          <Route path="foods/:id" element={<CatalogDetail />} />
          <Route path="recipes" element={<Catalog kind="recipes" admin />} />
          <Route
            path="recipes/:id"
            element={<CatalogDetail kind="recipes" />}
          />
          {[
            "users",
            "categories",
            "articles",
            "feedback",
            "ai",
            "audit",
            "plans",
          ].map((k) => (
            <Route key={k} path={k} element={<AdminResource kind={k} />} />
          ))}
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Route>
      <Route
        path="*"
        element={
          <Empty
            title="Trang này chưa tồn tại"
            text="Quay về không gian dinh dưỡng của bạn."
          >
            <Button asChild>
              <Link to="/app">Về tổng quan</Link>
            </Button>
          </Empty>
        }
      />
    </Routes>
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <MotionConfig reducedMotion="user">
              <Suspense fallback={<Loading />}>
                <App />
              </Suspense>
              <Toaster position="top-right" richColors closeButton />
            </MotionConfig>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
