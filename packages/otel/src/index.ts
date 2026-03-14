import { context } from "@opentelemetry/api";
import type { SeverityNumber } from "@opentelemetry/api-logs";
import { logs } from "@opentelemetry/api-logs";
import { LoggerProvider, BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { Resource } from "@opentelemetry/resources";

const SEVERITY: Record<string, SeverityNumber> = {
  info: 9,
  warn: 13,
  error: 17,
};

let loggerProvider: LoggerProvider | null = null;
let otelLogger: ReturnType<LoggerProvider["getLogger"]> | null = null;
let sdk: NodeSDK | null = null;

function isOtelEnabled(): boolean {
  if (process.env.OTEL_SDK_DISABLED === "true") return false;
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  return Boolean(endpoint && endpoint.trim());
}

export function initTelemetry(serviceName: string): void {
  if (!isOtelEnabled()) return;
  const name = process.env.OTEL_SERVICE_NAME ?? serviceName;

  const resource = new Resource({
    "service.name": name,
  });

  const traceExporter = new OTLPTraceExporter();
  sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });
  sdk.start();

  const logExporter = new OTLPLogExporter();
  loggerProvider = new LoggerProvider({ resource });
  loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(logExporter));
  logs.setGlobalLoggerProvider(loggerProvider);
  otelLogger = loggerProvider.getLogger("default", "1.0.0");

  process.on("SIGTERM", () => {
    void sdk?.shutdown().finally(() => process.exit(0));
  });
}

export function log(
  level: "info" | "warn" | "error",
  msg: string,
  data?: Record<string, unknown>
): void {
  const line = data ? `${msg} ${JSON.stringify(data)}` : msg;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  if (otelLogger) {
    const attributes: Record<string, string | number | boolean> = {};
    if (data) {
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined && v !== null) {
          attributes[k] =
            typeof v === "object" ? JSON.stringify(v) : (v as string | number | boolean);
        }
      }
    }
    otelLogger.emit({
      severityNumber: SEVERITY[level] ?? 9,
      severityText: level.toUpperCase(),
      body: msg,
      attributes,
      context: context.active(),
    });
  }
}
