import { Effect } from "effect";
import { HttpServerRequest } from "effect/http";

/** Trusted as is: the server is reached through the relay only, which replaces what the client sent. */
export const clientIp = Effect.map(
  HttpServerRequest.HttpServerRequest,
  (request) => request.headers["x-forwarded-for"]?.trim() || "unknown",
);
