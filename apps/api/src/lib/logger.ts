import { log as otelLog } from "otel";

const LOG_PREFIX = "[api]";

export function log(level: "info" | "warn" | "error", msg: string, data?: Record<string, unknown>) {
  otelLog(level, `${LOG_PREFIX} ${msg}`, data);
}
