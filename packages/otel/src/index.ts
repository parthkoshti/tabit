import {
  context,
  SpanStatusCode,
  trace,
  type Span,
  type SpanOptions,
} from "@opentelemetry/api";
import type { SeverityNumber } from "@opentelemetry/api-logs";
import { logs } from "@opentelemetry/api-logs";
import {
  LoggerProvider,
  BatchLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { Resource } from "@opentelemetry/resources";
import pino from "pino";
import pinoPretty from "pino-pretty";

const SEVERITY: Record<string, SeverityNumber> = {
  info: 9,
  warn: 13,
  error: 17,
};

const isDev = process.env.NODE_ENV !== "production";

const pinoLogger = isDev
  ? pino(
      { level: "trace" },
      pinoPretty({ colorize: true, translateTime: "HH:MM:ss.l", ignore: "pid,hostname" }),
    )
  : pino({ level: "info" });

let loggerProvider: LoggerProvider | null = null;
let otelLogger: ReturnType<LoggerProvider["getLogger"]> | null = null;
let sdk: NodeSDK | null = null;
const tracer = trace.getTracer("tabit", "1.0.0");

function isOtelEnabled(): boolean {
  if (process.env.OTEL_SDK_DISABLED === "true") return false;
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  return Boolean(endpoint && endpoint.trim());
}

export function initTelemetry(serviceName: string): void {
  if (!isOtelEnabled()) return;
  const name = process.env.OTEL_SERVICE_NAME?.trim() || `tab-${serviceName}`;
  const deploymentEnv =
    process.env.NODE_ENV === "production" ? "production" : "development";

  const resource = new Resource({
    "service.name": name,
    "deployment.environment.name": deploymentEnv,
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
  loggerProvider.addLogRecordProcessor(
    new BatchLogRecordProcessor(logExporter),
  );
  logs.setGlobalLoggerProvider(loggerProvider);
  otelLogger = loggerProvider.getLogger("default", "1.0.0");

  process.on("SIGTERM", () => {
    void sdk?.shutdown().finally(() => process.exit(0));
  });
}

export function log(
  level: "info" | "warn" | "error",
  msg: string,
  data?: Record<string, unknown>,
): void {
  const activeSpan = trace.getSpan(context.active());
  const spanContext = activeSpan?.spanContext();
  const enriched =
    spanContext && spanContext.traceId
      ? {
          traceId: spanContext.traceId,
          spanId: spanContext.spanId,
          ...(data ?? {}),
        }
      : (data ?? {});

  pinoLogger[level](enriched, msg);

  if (otelLogger) {
    const attributes: Record<string, string | number | boolean> = {};
    if (enriched) {
      for (const [k, v] of Object.entries(enriched)) {
        if (v !== undefined && v !== null) {
          attributes[k] =
            typeof v === "object"
              ? JSON.stringify(v)
              : (v as string | number | boolean);
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

export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean | undefined | null>,
  fn: (span: Span) => Promise<T>,
  options?: SpanOptions,
): Promise<T> {
  const span = tracer.startSpan(name, options);
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null) {
      span.setAttribute(key, value);
    }
  }

  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err instanceof Error ? err : new Error(String(err)));
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      span.end();
    }
  });
}
