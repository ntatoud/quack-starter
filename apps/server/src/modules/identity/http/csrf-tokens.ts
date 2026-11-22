import { sessionCookie } from "@quack/contracts/identity/authentication";
import { InvalidCsrfToken } from "@quack/contracts/oauth/oauth-errors";
import { Context, Effect, Layer, Result } from "effect";
import { Digest, Mac } from "effect/crypto";
import { Base64Url } from "effect/encoding";
import { HttpServerRequest } from "effect/http";

/**
 * The token a page sends back with a decision of the User, proving the decision was made on it.
 * @effect-expect-leaking HttpServerRequest
 */
export class CsrfTokens extends Context.Service<
  CsrfTokens,
  {
    readonly ofSession: Effect.Effect<string, never, HttpServerRequest.HttpServerRequest>;
    verify(
      received: string,
    ): Effect.Effect<void, InvalidCsrfToken, HttpServerRequest.HttpServerRequest>;
  }
>()("@quack/server/identity/CsrfTokens") {
  static readonly layer = Layer.effect(
    CsrfTokens,
    Effect.gen(function* () {
      const digest = yield* Digest.Digest;

      // Derived from the session token, which only the User's browser holds (an httpOnly cookie): another site
      // can neither read nor compute it, and it changes with the Session. Prefixed, so it is never the stored hash.
      const tokenOfRequest = Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) =>
        digest.digest(
          Digest.sha256,
          new TextEncoder().encode(`csrf:${request.cookies[sessionCookie.key] ?? ""}`),
        ),
      );

      return CsrfTokens.of({
        ofSession: Effect.map(tokenOfRequest, Base64Url.encode),
        verify: Effect.fn("CsrfTokens.verify")(function* (received) {
          const expected = yield* tokenOfRequest;
          const decoded = Base64Url.decode(received);

          if (Result.isFailure(decoded) || !Mac.timingSafeEqual(expected, decoded.success)) {
            return yield* new InvalidCsrfToken();
          }
        }),
      });
    }),
  );
}
