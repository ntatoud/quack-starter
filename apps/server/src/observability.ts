import { API_PREFIX } from "@quack/contracts/api";
import { Effect, Exit, Layer, Logger, Option, References } from "effect";
import {
  FetchHttpClient,
  HttpMiddleware,
  HttpServerError,
  HttpServerRequest,
  type HttpServerResponse,
} from "effect/http";
import { OtlpLogger, OtlpSerialization, OtlpTracer } from "effect/observability";

import { ObservabilityConfig } from "#/config.ts";

import serverPackage from "#package.json" with { type: "json" };

// Probed every few seconds: a line and a span each time would drown the requests of people.
const healthPath = `${API_PREFIX}/health`;

const pathOf = (url: string) => new URL(url, "http://server").pathname;

export const HealthUntraced = Layer.succeed(HttpMiddleware.TracerDisabledWhen)(
  (request) => pathOf(request.url) === healthPath,
);

/** One line per response, at `Error` with its cause for a 5xx. Every log of the request carries its `trace_id`. */
export const requestLogger = <E, R>(
  httpApp: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  E,
  R | HttpServerRequest.HttpServerRequest
> =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const path = pathOf(request.url);
    if (path === healthPath) return yield* httpApp;

    const respond = Effect.gen(function* () {
      const exit = yield* Effect.exit(httpApp);
      const [response, cause] = Exit.isSuccess(exit)
        ? [exit.value, Option.none()]
        : HttpServerError.causeResponseStripped(exit.cause);
      const line =
        response.status >= 500 && Option.isSome(cause)
          ? Effect.logError("Sent HTTP response", cause.value)
          : Effect.logInfo("Sent HTTP response");
      yield* Effect.annotateLogs(line, {
        "http.method": request.method,
        "http.path": path,
        "http.status": response.status,
      });
      return yield* exit;
    });
    const span = yield* Effect.option(Effect.currentSpan);
    return yield* Option.isSome(span)
      ? Effect.annotateLogs(respond, "trace_id", span.value.traceId)
      : respond;
  }).pipe(Effect.withLogSpan("http.duration"));

const consoleLogger = Effect.map(ObservabilityConfig, ({ logFormat }) =>
  logFormat === "json" ? Logger.consoleJson : Logger.consolePretty(),
);

const minimumLevel = Layer.unwrap(
  Effect.map(ObservabilityConfig, ({ logLevel }) =>
    Layer.succeed(References.MinimumLogLevel, logLevel),
  ),
);

/** For the scripts: the console only, never exported. */
export const ConsoleLogger = Layer.merge(Logger.layer([consoleLogger]), minimumLevel);

const otlpUrl = (endpoint: URL, signal: "logs" | "traces") =>
  new URL(`v1/${signal}`, endpoint.href.endsWith("/") ? endpoint : `${endpoint.href}/`).href;

/** Console logs, plus logs and traces over OTLP/HTTP when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. */
export const Observability = Layer.unwrap(
  Effect.gen(function* () {
    const { otlpEndpoint, deploymentEnvironment } = yield* ObservabilityConfig;
    // The tracer logger copies each log onto the span it happens in, as an event.
    if (Option.isNone(otlpEndpoint)) {
      return Layer.merge(Logger.layer([consoleLogger, Logger.tracerLogger]), minimumLevel);
    }
    const resource = {
      serviceName: "quack-server",
      serviceVersion: serverPackage.version,
      attributes: { "deployment.environment.name": deploymentEnvironment },
    };
    const otlpLogger = OtlpLogger.make({ url: otlpUrl(otlpEndpoint.value, "logs"), resource });
    return Layer.merge(
      Logger.layer([consoleLogger, Logger.tracerLogger, otlpLogger]),
      minimumLevel,
    ).pipe(
      Layer.provideMerge(
        OtlpTracer.layer({ url: otlpUrl(otlpEndpoint.value, "traces"), resource }),
      ),
      Layer.provide([OtlpSerialization.layerJson, FetchHttpClient.layer]),
    );
  }),
);
