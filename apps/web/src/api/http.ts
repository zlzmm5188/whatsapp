import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { BACKEND_ORIGIN } from "./base";

export const http = axios.create({
  baseURL: `${BACKEND_ORIGIN}/api`,
  timeout: 15000,
});

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("im_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ message?: string | string[] }>) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("im_token");
      localStorage.removeItem("im_user");
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
    }
    return Promise.reject(err);
  },
);

export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const m = err.response?.data?.message;
    if (Array.isArray(m)) return m.join(", ");
    if (typeof m === "string") return m;
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
