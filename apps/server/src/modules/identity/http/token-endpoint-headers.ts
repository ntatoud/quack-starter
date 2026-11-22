import { API_PREFIX } from "@quack/contracts/api";
import { Effect } from "effect";
import { HttpMiddleware, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

const tokenPath = `${API_PREFIX}/oauth/token`;

// An AI Client running in a browser exchanges its code from its own origin. It sends no cookie: the code and its
// verifier are its only proof, so any origin may call.
const callableFromAnyOrigin = HttpMiddleware.cors({ allowedMethods: ["POST"] });

/**
 * The headers of the token endpoint that an `HttpApi` endpoint cannot declare: CORS, preflight included, and
 * `Cache-Control: no-store`, since its response holds an access token (RFC 6749 s5.1).
 */
export const TokenEndpointHeaders = HttpRouter.middleware(
  (httpEffect) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;

      if (new URL(request.url, "http://quack").pathname !== tokenPath) return yield* httpEffect;

      return yield* callableFromAnyOrigin(
        Effect.map(httpEffect, HttpServerResponse.setHeader("cache-control", "no-store")),
      );
    }),
  { global: true },
);
