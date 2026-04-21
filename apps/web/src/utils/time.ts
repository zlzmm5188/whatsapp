export function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return "昨天";
  if (now.getTime() - d.getTime() < 7 * 24 * 3600 * 1000) {
    return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()]!;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
