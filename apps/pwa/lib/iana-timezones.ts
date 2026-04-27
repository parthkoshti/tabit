/** Sorted IANA zones supported by the runtime (Chromium, Safari 16+, modern Firefox). */
export function getSupportedIanaTimeZones(): string[] {
  try {
    const intl = Intl as unknown as {
      supportedValuesOf?: (key: string) => string[];
    };
    const list = intl.supportedValuesOf?.("timeZone");
    if (list?.length) {
      const sorted = [...list].sort((a, b) => a.localeCompare(b));
      const rest = sorted.filter((z) => z !== "UTC");
      return ["UTC", ...rest];
    }
  } catch {
    /* ignore */
  }
  return ["UTC", "America/Los_Angeles", "America/New_York", "Europe/London"];
}
