// Tiny helper for haptic feedback on touch devices. navigator.vibrate is
// only honored on Android Chrome / some mobile browsers and is a cheap no-op
// everywhere else, so we just try and swallow. Keep pulses short (≤15ms) so
// interactions feel "tactile" instead of buzzy.
type HapticKind = "tap" | "success" | "warn";

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  success: [6, 24, 10],
  warn: [12, 40, 12],
};

export function haptic(kind: HapticKind = "tap"): void {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & {
    vibrate?: (p: number | readonly number[]) => boolean;
  };
  if (typeof nav.vibrate !== "function") return;
  try {
    const p = PATTERNS[kind];
    // Array.isArray narrows to unknown[]; pass through as readonly.
    nav.vibrate(Array.isArray(p) ? [...p] : p);
  } catch {
    // ignore
  }
}
