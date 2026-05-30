const TAP_DEBOUNCE_MS = 50;
const TAP_VIBRATE_MS = 15;

let lastTapHapticAt = 0;

const INTERACTIVE_SELECTOR = [
  "button:not(:disabled)",
  "a[href]",
  '[role="button"]:not([aria-disabled="true"])',
  '[role="switch"]:not([aria-disabled="true"])',
  '[role="link"]',
  'input[type="checkbox"]:not(:disabled)',
  'input[type="radio"]:not(:disabled)',
  'input[type="submit"]:not(:disabled)',
  'input[type="reset"]:not(:disabled)',
  'input[type="button"]:not(:disabled)',
  "select:not(:disabled)",
  "summary",
  "[data-haptic]",
].join(",");

function isAppleTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Safari 17.4+ Taptic Engine via hidden switch — must run in a native user gesture. */
function iosSwitchHaptic(): void {
  try {
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.display = "none";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    label.appendChild(input);

    const root = document.body ?? document.head;
    root.appendChild(label);
    label.click();
    label.remove();
  } catch {
    // no-op
  }
}

function shouldHapticTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("[data-no-haptic]")) return false;
  return target.closest(INTERACTIVE_SELECTOR) != null;
}

function runTapHaptic(): void {
  const now = Date.now();
  if (now - lastTapHapticAt < TAP_DEBOUNCE_MS) return;
  lastTapHapticAt = now;

  if (isAppleTouchDevice()) {
    iosSwitchHaptic();
    return;
  }

  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(TAP_VIBRATE_MS);
  }
}

let unregisterGlobalTapHaptic: (() => void) | null = null;

/**
 * Capture-phase click — one event per tap (touchend + click both fire on iOS).
 * Runs before React so the switch haptic keeps the trusted user gesture.
 */
function handleNativeTap(e: MouseEvent): void {
  if (!e.isTrusted) return;
  if (!shouldHapticTarget(e.target)) return;
  runTapHaptic();
}

export function registerGlobalTapHaptic(): () => void {
  if (typeof window === "undefined") return () => {};

  unregisterGlobalTapHaptic?.();

  const opts: AddEventListenerOptions = { capture: true, passive: true };
  window.addEventListener("click", handleNativeTap, opts);

  unregisterGlobalTapHaptic = () => {
    window.removeEventListener("click", handleNativeTap, opts);
    unregisterGlobalTapHaptic = null;
  };

  return unregisterGlobalTapHaptic;
}

/** Imperative tap haptic — prefer registerGlobalTapHaptic for buttons; use this inside sync user handlers. */
export function triggerTapHaptic(): void {
  runTapHaptic();
}

/** Longer haptic pattern — Android vibrate; iOS uses switch tick when duration >= 50. */
export function vibrate(duration = 100): void {
  if (isAppleTouchDevice()) {
    if (duration >= 50) iosSwitchHaptic();
    return;
  }

  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(duration);
  }
}
