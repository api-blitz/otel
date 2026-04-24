# Examples — visualize traces locally with Jaeger UI

Each instrumentation package ships an `examples/` playground that replays a realistic workload through the instrumentation and exports the resulting spans to a local Jaeger via OTLP/HTTP. Use it to sanity-check that the traces look right in an actual observability UI — span tree, timings, kind, and attributes — without standing up a real Autumn/Drizzle environment.

## Prerequisites

- Docker (Jaeger runs in a container)
- pnpm + Node ≥ 18.19 / 20.6 (same as the packages themselves)

## 1. Start Jaeger

From the repo root:

```bash
docker compose up -d
```

This launches `jaegertracing/all-in-one` with OTLP enabled, exposing:

- `http://localhost:16686` — Jaeger UI
- `http://localhost:4318` — OTLP HTTP endpoint (what the demos push to)
- `http://localhost:4317` — OTLP gRPC endpoint

## 2. Install workspace dependencies (first time only)

```bash
pnpm install
```

## 3. Run a demo

Pick the package you want to exercise. Each demo uses **plain-object mocks** of the underlying SDK — no API keys, no running Postgres.

```bash
# Autumn — replays all 36 instrumented methods + 1 error path (37 spans total)
pnpm --filter @api-blitz/otel-autumn example

# Drizzle — replays every instrumentation surface (30 spans: all SQL verbs,
# query-object shapes, transactions, callback pattern, error path, truncation)
pnpm --filter @api-blitz/otel-drizzle example
```

You can run both back-to-back; each writes to a different service name so the traces don't collide.

## 4. Inspect traces

Open <http://localhost:16686>, then in the **Service** dropdown pick:

- `otel-autumn-demo` — every `autumn.*` operation
- `otel-drizzle-demo` — every `drizzle.*` operation

Click **Find Traces** and drill into any trace to see its attributes. Each per-package `examples/README.md` has a full table of expected span names and attributes so you can cross-reference what you're seeing:

- [otel-autumn example](./packages/otel-autumn/examples/README.md)
- [otel-drizzle example](./packages/otel-drizzle/examples/README.md)

## 5. Stop Jaeger

```bash
docker compose down
```

## Troubleshooting

- **`ECONNREFUSED` from the demo** — Jaeger isn't up, or `:4318` is being used by something else. Run `docker compose up -d` first.
- **Pointing at a different OTLP collector** — set `OTEL_EXPORTER_OTLP_ENDPOINT`, e.g. `OTEL_EXPORTER_OTLP_ENDPOINT=http://my-collector:4318 pnpm --filter @api-blitz/otel-autumn example`.
- **Traces stick around between runs** — Jaeger's in-memory storage retains traces until the container restarts. `docker compose restart` clears them.
