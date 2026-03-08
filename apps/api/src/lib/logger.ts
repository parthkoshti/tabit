const LOG_PREFIX = "[api]";

export function log(level: "info" | "warn" | "error", msg: string, data?: Record<string, unknown>) {
  const line = data ? `${LOG_PREFIX} ${msg} ${JSON.stringify(data)}` : `${LOG_PREFIX} ${msg}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
