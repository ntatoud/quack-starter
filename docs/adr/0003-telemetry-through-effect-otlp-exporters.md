# 0003: Telemetry through Effect's own OTLP exporters, not the OpenTelemetry SDK

Accepted, 2026-11-21.

## Context

The server needs logs and traces an operator can search. A newcomer expects `@opentelemetry/sdk-node` with its auto-instrumentation of `http` and `pg`. The server is written in Effect v4: every service method is an `Effect.fn`, which already opens a span, and the HTTP server and `effect/sql` open their own spans for each request and statement. `effect/observability` ships `OtlpTracer` and `OtlpLogger`, which export those spans and `Effect.log` entries over OTLP/HTTP with no other dependency.

## Decision

- Logs and traces leave the server through `OtlpTracer` and `OtlpLogger` of `effect/observability`, over OTLP/HTTP, to whatever backend `OTEL_EXPORTER_OTLP_ENDPOINT` names. No `@opentelemetry/*` package, no vendor SDK.
- Without that endpoint nothing is exported: a fresh clone, the tests, and the scripts log to the console only.
- Metrics and the web app's telemetry are left for later.

## Considered Options

- **OpenTelemetry Node SDK with auto-instrumentation**: instruments `http` and `pg` below Effect, so each request and query gets a second, parallel span tree that does not know the Effect spans, plus a dozen dependencies loaded before the app starts.
- **A vendor SDK** (Sentry, Datadog): ties the starter to one backend.

## Consequences

- Only what runs in Effect is traced. A library called outside Effect shows up only through the span of the `Effect.fn` that calls it.
- Span and attribute names come from Effect (`db.query.text`, `http.request.method`): dashboards depend on them, so an Effect upgrade that renames one shows up there.
- The OTLP modules of Effect are unstable; the catalog pins their version.
