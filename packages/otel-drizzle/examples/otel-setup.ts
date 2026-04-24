import { trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

const JAEGER_OTLP_URL =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/$/, "") ??
  "http://localhost:4318";

export function setupOtel(serviceName: string): NodeTracerProvider {
  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
    }),
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: `${JAEGER_OTLP_URL}/v1/traces`,
          timeoutMillis: 3000,
        }),
      ),
    ],
  });
  trace.setGlobalTracerProvider(provider);
  return provider;
}
