import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
let csrf = "";
let refreshing: Promise<any> | null = null;
const base = "/api/v1";
export async function api(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<any> {
  const res = await fetch(base + path, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      "x-csrf-token": csrf,
      ...options.headers,
    },
  });
  if (
    res.status === 401 &&
    retry &&
    !["/auth/login", "/auth/register", "/auth/refresh"].includes(path)
  ) {
    if (!refreshing)
      refreshing = fetch(base + "/auth/refresh", {
        method: "POST",
        credentials: "include",
      })
        .then(async (r) => {
          if (!r.ok) throw new Error("Vui lòng đăng nhập.");
          const j = await r.json();
          csrf = j.data.csrf;
          return j.data;
        })
        .finally(() => {
          refreshing = null;
        });
    await refreshing;
    return api(path, options, false);
  }
  const json = await res.json().catch(() => null);
  if (!json)
    throw new Error(
      "Chưa kết nối được backend. Kiểm tra máy chủ hoặc tải lại trang.",
    );
  if (!res.ok) throw new Error(json.error || "Không thể kết nối máy chủ.");
  if (json.data?.csrf) csrf = json.data.csrf;
  return json;
}
export const write = (path: string, data?: unknown, method = "POST") =>
  api(path, {
    method,
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
export const useData = (key: string, path: string) =>
  useQuery({ queryKey: [key, path], queryFn: () => api(path) });
export function useWrite(
  action: (data: any) => Promise<any>,
  message = "Đã lưu thay đổi.",
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: () => {
      qc.invalidateQueries();
      if (message) toast.success(message);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
type Auth = {
  user: any;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => void;
};
const AuthContext = createContext<Auth>(null!);
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["auth"],
    queryFn: async () => {
      try {
        const r = await api("/auth/me");
        return r.data.user;
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 60000,
  });
  const login = async (email: string, password: string) => {
    await qc.cancelQueries({queryKey:['auth']});
    const r = await write("/auth/login", { email, password });
    qc.removeQueries({predicate:query=>query.queryKey[0]!=='auth'});
    qc.setQueryData(["auth"], r.data.user);
  };
  const register = async (data: any) => {
    await qc.cancelQueries({queryKey:['auth']});
    const r = await write("/auth/register", data);
    qc.removeQueries({predicate:query=>query.queryKey[0]!=='auth'});
    qc.setQueryData(["auth"], r.data.user);
  };
  const logout = async () => {
    await write("/auth/logout");
    await qc.cancelQueries();
    qc.removeQueries({predicate:query=>query.queryKey[0]!=='auth'});
    qc.setQueryData(["auth"], null);
  };
  return (
    <AuthContext.Provider
      value={{
        user:q.data||null,
        loading: q.isPending,
        login,
        register,
        logout,
        reload: () => qc.invalidateQueries({ queryKey: ["auth"] }),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const addDays = (date: string, n: number) =>
  new Date(Date.parse(date + "T12:00:00Z") + 86400000 * n)
    .toISOString()
    .slice(0, 10);
export const number = (n: number = 0) => Math.round(n).toLocaleString("vi-VN");
export const money = (n: number = 0) => number(n) + "đ";
export const mealNames: Record<string, string> = {
  breakfast: "Bữa sáng",
  lunch: "Bữa trưa",
  dinner: "Bữa tối",
  snack: "Bữa phụ",
};
export const prettyDate = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString("vi-VN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
