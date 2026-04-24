// Where the backend lives. In dev this is empty (Vite proxies /api /socket.io
// /uploads to http://localhost:3001). In production (Pages build) we bake the
// tunnel origin at build time via VITE_BACKEND_ORIGIN.
export const BACKEND_ORIGIN: string = (
  (import.meta.env.VITE_BACKEND_ORIGIN as string | undefined) ?? ""
).replace(/\/$/, "");

// Resolve a server-relative media path (e.g. "/uploads/xxx.jpg") to an
// absolute URL that points at the backend. In dev BACKEND_ORIGIN is "" so
// the path stays relative and flows through the Vite proxy.
export function resolveMedia(url: string | null | undefined): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return BACKEND_ORIGIN + url;
  return url;
}
