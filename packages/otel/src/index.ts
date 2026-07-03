import {
  context,
  propagation,
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

export type LogLevel = "debug" | "info" | "warn" | "error";

export const SLOW_RPC_MS = 1000;

const SEVERITY: Record<LogLevel, SeverityNumber> = {
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
};

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveLogLevel(): LogLevel {
  const env = process.env.LOG_LEVEL?.toLowerCase();
  if (env === "debug" || env === "info" || env === "warn" || env === "error") {
    return env;
  }
  return "info";
}

const configuredLogLevel = resolveLogLevel();

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[configuredLogLevel];
}

const isDev = process.env.NODE_ENV !== "production";

const pinoLogger = isDev
  ? pino(
      { level: configuredLogLevel },
      pinoPretty({
        colorize: true,
        translateTime: "HH:MM:ss.l",
        ignore: "pid,hostname",
      }),
    )
  : pino({ level: configuredLogLevel });

let loggerProvider: LoggerProvider | null = null;
let otelLogger: ReturnType<LoggerProvider["getLogger"]> | null = null;
let sdk: NodeSDK | null = null;
const tracer = trace.getTracer("tabit", "1.0.0");

function isSdkDisabled(): boolean {
  return process.env.OTEL_SDK_DISABLED === "true";
}

function hasOtlpEndpoint(): boolean {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  return Boolean(endpoint && endpoint.trim());
}

export function initTelemetry(serviceName: string): void {
  if (isSdkDisabled()) return;

  const name = process.env.OTEL_SERVICE_NAME?.trim() || `tab-${serviceName}`;
  const deploymentEnv =
    process.env.NODE_ENV === "production" ? "production" : "development";

  const resource = new Resource({
    "service.name": name,
    "deployment.environment.name": deploymentEnv,
  });

  const sdkOptions: ConstructorParameters<typeof NodeSDK>[0] = {
    resource,
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-http": {
          ignoreIncomingRequestHook: (req) => {
            const url = req.url ?? "";
            return url.includes("/health") || url.startsWith("/socket.io");
          },
        },
        "@opentelemetry/instrumentation-pg": {
          enabled: true,
          enhancedDatabaseReporting: true,
        },
      }),
    ],
  };

  if (hasOtlpEndpoint()) {
    sdkOptions.traceExporter = new OTLPTraceExporter();
  }

  sdk = new NodeSDK(sdkOptions);
  sdk.start();

  if (hasOtlpEndpoint()) {
    const logExporter = new OTLPLogExporter();
    loggerProvider = new LoggerProvider({ resource });
    loggerProvider.addLogRecordProcessor(
      new BatchLogRecordProcessor(logExporter),
    );
    logs.setGlobalLoggerProvider(loggerProvider);
    otelLogger = loggerProvider.getLogger("default", "1.0.0");
  }

  process.on("SIGTERM", () => {
    void sdk?.shutdown().finally(() => process.exit(0));
  });
}

type SpanAttributeValue = string | number | boolean | undefined | null;

function enrichWithTraceContext(
  data?: Record<string, unknown>,
): Record<string, unknown> {
  const activeSpan = trace.getSpan(context.active());
  const spanContext = activeSpan?.spanContext();
  if (!spanContext?.traceId) {
    return data ?? {};
  }
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    ...(data ?? {}),
  };
}

function emitOtelLog(
  level: LogLevel,
  msg: string,
  enriched: Record<string, unknown>,
): void {
  if (!otelLogger) return;
  const attributes: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(enriched)) {
    if (v !== undefined && v !== null) {
      attributes[k] =
        typeof v === "object" ? JSON.stringify(v) : (v as string | number | boolean);
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

export function log(
  level: LogLevel,
  msg: string,
  data?: Record<string, unknown>,
): void {
  if (!shouldLog(level)) return;
  const enriched = enrichWithTraceContext(data);
  pinoLogger[level](enriched, msg);
  emitOtelLog(level, msg, enriched);
}

export function debug(msg: string, data?: Record<string, unknown>): void {
  log("debug", msg, data);
}

export function spanEvent(
  name: string,
  attributes?: Record<string, SpanAttributeValue>,
): void {
  const span = trace.getSpan(context.active());
  if (!span) return;
  const attrs: Record<string, string | number | boolean> = {};
  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== undefined && value !== null) {
        attrs[key] = value;
      }
    }
  }
  span.addEvent(name, attrs);
}

export function setSpanAttributes(
  attributes: Record<string, SpanAttributeValue>,
): void {
  const span = trace.getSpan(context.active());
  if (!span) return;
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null) {
      span.setAttribute(key, value);
    }
  }
}

export function injectTraceContext(carrier: Record<string, string>): void {
  propagation.inject(context.active(), carrier);
}

export async function runWithTraceContext<T>(
  carrier: Record<string, string> | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (!carrier || Object.keys(carrier).length === 0) {
    return fn();
  }
  const extracted = propagation.extract(context.active(), carrier);
  return context.with(extracted, fn);
}

export async function withSpan<T>(
  name: string,
  attributes: Record<string, SpanAttributeValue>,
  fn: (span: Span) => Promise<T>,
  options?: SpanOptions,
): Promise<T> {
  const parentCtx = context.active();
  const span = tracer.startSpan(name, options, parentCtx);
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null) {
      span.setAttribute(key, value);
    }
  }

  return context.with(trace.setSpan(parentCtx, span), async () => {
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
