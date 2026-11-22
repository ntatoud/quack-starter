import { Cache, Clock, Duration, Effect, Exit, Layer, Schema, Stream } from "effect";
import { HttpClient, HttpClientRequest, type HttpClientResponse } from "effect/http";

import {
  AiClientDocuments,
  AiClientDocumentUnavailable,
} from "#/modules/identity/domain/ai-client.ts";

// A document is a few fields: anything larger is not one, and must not hold the server.
const maxBytes = 5 * 1024;
const fetchTimeout = Duration.seconds(5);

// Bounds how long a document the AI Client changed, a redirect URI it dropped among them, stays trusted.
const longestFreshness = Duration.days(1);
const cachedDocuments = 1000;

const unavailable = (reason: string) => new AiClientDocumentUnavailable({ reason });

const secondsIn = (directives: ReadonlyArray<string>, name: string) => {
  const directive = directives.find((candidate) => candidate.startsWith(`${name}=`));
  const seconds = Number(directive?.slice(name.length + 1));

  return directive !== undefined && Number.isInteger(seconds) ? seconds : undefined;
};

/** The lifetime `Expires` gives, counted from the response's `Date`, or from now without one. */
const secondsUntilExpires = (
  headers: HttpClientResponse.HttpClientResponse["headers"],
  nowMillis: number,
) => {
  const expires = Date.parse(headers["expires"] ?? "");
  const date = Date.parse(headers["date"] ?? "");

  return Number.isNaN(expires) ? 0 : (expires - (Number.isNaN(date) ? nowMillis : date)) / 1000;
};

/**
 * How long the document may be reused (RFC 9111 s4.2): its lifetime by `s-maxage`, `max-age`, or
 * `Expires`, less its `Age`. Zero when the headers give none: no heuristic freshness.
 */
const freshnessOf = (response: HttpClientResponse.HttpClientResponse, nowMillis: number) => {
  const { headers } = response;

  const directives = (headers["cache-control"] ?? "")
    .split(",")
    .map((directive) => directive.trim().toLowerCase());

  // `private` too: Quack is a shared cache, one document serving every User.
  if (directives.some((directive) => ["no-store", "no-cache", "private"].includes(directive))) {
    return Duration.zero;
  }

  const lifetime =
    secondsIn(directives, "s-maxage") ??
    secondsIn(directives, "max-age") ??
    secondsUntilExpires(headers, nowMillis);

  const remaining = lifetime - (Number(headers["age"]) || 0);

  return remaining > 0
    ? Duration.min(Duration.seconds(remaining), longestFreshness)
    : Duration.zero;
};

const bodyOf = (response: HttpClientResponse.HttpClientResponse) =>
  Stream.runFoldEffect(
    response.stream,
    () => new Uint8Array(0),
    (body, chunk) =>
      body.length + chunk.length > maxBytes
        ? Effect.fail(unavailable(`it is larger than ${maxBytes} bytes`))
        : Effect.succeed(new Uint8Array([...body, ...chunk])),
  ).pipe(
    Effect.mapError((error) =>
      error._tag === "AiClientDocumentUnavailable"
        ? error
        : unavailable("its body could not be read"),
    ),
  );

/**
 * Fetches documents through the `HttpClient` it is given, which must follow no redirect and refuse
 * the addresses of Quack's own network (`AiClientHttpClient`). Only successes are cached, as long as
 * the document's server says.
 */
export const AiClientDocumentsHttp = Layer.effect(
  AiClientDocuments,
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;

    const fetchDocument = Effect.fnUntraced(
      function* (url: string) {
        const response = yield* client
          .execute(HttpClientRequest.get(url).pipe(HttpClientRequest.acceptJson))
          .pipe(Effect.mapError(() => unavailable("the request failed")));

        if (response.status !== 200) {
          return yield* unavailable(`it answered ${response.status}`);
        }

        if (Number(response.headers["content-length"] ?? 0) > maxBytes) {
          return yield* unavailable(`it is larger than ${maxBytes} bytes`);
        }

        const body = new TextDecoder().decode(yield* bodyOf(response));

        const document = yield* Effect.try({
          try: (): Schema.Json => JSON.parse(body),
          catch: () => unavailable("it is not JSON"),
        });

        return { document, freshness: freshnessOf(response, yield* Clock.currentTimeMillis) };
      },
      Effect.timeoutOrElse({
        duration: fetchTimeout,
        orElse: () => Effect.fail(unavailable("it did not answer in time")),
      }),
    );

    const cache = yield* Cache.makeWith(fetchDocument, {
      capacity: cachedDocuments,
      timeToLive: (exit) => (Exit.isSuccess(exit) ? exit.value.freshness : Duration.zero),
    });

    return AiClientDocuments.of({
      fetch: (url) => Effect.map(Cache.get(cache, url.href), ({ document }) => document),
    });
  }),
);
