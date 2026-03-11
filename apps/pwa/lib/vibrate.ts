/** Triggers a short haptic feedback. Safe to call; no-op when unsupported. */
export function vibrate(duration = 100): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(duration);
  }
}
