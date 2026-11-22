import type { TooManyAttempts } from "@quack/contracts/identity/identity-errors";
import type { UserId } from "@quack/contracts/identity/user";
import { MCP_PATH } from "@quack/contracts/api";
import type {
  AuthorizationRequestParams,
  ConsentDetails,
} from "@quack/contracts/oauth/authorization-request";
import type { Permission } from "@quack/contracts/permission";
import { AuthorizationRequestRefused } from "@quack/contracts/oauth/oauth-errors";
import { Context, DateTime, Effect, Layer, Option } from "effect";
import { Digest, SecureRandom } from "effect/crypto";
import { Base64Url } from "effect/encoding";

import { ServerConfig } from "#/config.ts";
import { sha256Hex } from "#/modules/identity/application/sha256-hex.ts";
import {
  AiClientDocuments,
  aiClientUrlOf,
  checkAuthorizationRequest,
  type ValidAuthorizationRequest,
} from "#/modules/identity/domain/ai-client.ts";
import { AttemptCounter, AttemptLimiter } from "#/modules/identity/domain/attempt-limiter.ts";
import {
  authorizationCodeBytes,
  authorizationCodeLifetime,
} from "#/modules/identity/domain/authorization-code.ts";
import { AuthorizationCodeStore } from "#/modules/identity/domain/authorization-code-store.ts";
import {
  grantableOf,
  grantablePermissions,
  grantLifetime,
  remembersConsent,
} from "#/modules/identity/domain/grant.ts";
import { GrantStore } from "#/modules/identity/domain/grant-store.ts";

export class AuthorizationRequests extends Context.Service<
  AuthorizationRequests,
  {
    check(
      params: AuthorizationRequestParams,
      userId: UserId,
    ): Effect.Effect<typeof ConsentDetails.Type, AuthorizationRequestRefused | TooManyAttempts>;
    approve(
      params: AuthorizationRequestParams,
      chosen: ReadonlyArray<Permission>,
      userId: UserId,
    ): Effect.Effect<string, AuthorizationRequestRefused>;
    deny(params: AuthorizationRequestParams): Effect.Effect<string, AuthorizationRequestRefused>;
  }
>()("@quack/server/identity/AuthorizationRequests") {
  static readonly layer = Layer.effect(
    AuthorizationRequests,
    Effect.gen(function* () {
      const documents = yield* AiClientDocuments;
      const codes = yield* AuthorizationCodeStore;
      const grants = yield* GrantStore;
      const limiter = yield* AttemptLimiter;
      const random = yield* SecureRandom.SecureRandom;
      const digest = yield* Digest.Digest;
      const issuer = yield* ServerConfig.publicOrigin;
      const rememberConsent = yield* ServerConfig.rememberConsent;

      const server = {
        issuer,
        mcpResource: `${issuer}${MCP_PATH}`,
        allowLoopbackHttpDocuments: yield* ServerConfig.allowLoopbackHttpAiClients,
      };

      /**
       * `beforeFetch` runs when the document is not in the cache, before Quack fetches it: only `check`
       * counts the fetches, since `approve` and `deny` follow a request `check` already counted.
       */
      const validate = Effect.fn("AuthorizationRequests.validate")(function* <E = never>(
        params: AuthorizationRequestParams,
        beforeFetch: Effect.Effect<void, E> = Effect.void,
      ) {
        const url = yield* aiClientUrlOf(params.client_id, server);
        const cached = yield* documents.cached(url);

        const document = Option.isSome(cached)
          ? cached.value
          : yield* Effect.andThen(
              beforeFetch,
              documents.fetch(url).pipe(
                Effect.mapError(
                  ({ reason }) =>
                    new AuthorizationRequestRefused({
                      error: "invalid_client",
                      error_description: `Could not fetch the AI Client's document: ${reason}`,
                    }),
                ),
              ),
            );

        return yield* checkAuthorizationRequest(params, url, document, server);
      });

      // RFC 9207: `iss` tells the AI Client which authorization server answers, against mix-up attacks.
      const redirectOf = (request: ValidAuthorizationRequest, params: Record<string, string>) => {
        const url = new URL(request.redirectUri);

        for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);

        if (request.state !== undefined) url.searchParams.set("state", request.state);
        url.searchParams.set("iss", issuer);

        return url.href;
      };

      const activeGrantOf = (userId: UserId, aiClientId: string) =>
        Effect.gen(function* () {
          const now = yield* DateTime.now;

          return Option.filter(yield* grants.findOf(userId, aiClientId), (grant) =>
            DateTime.isLessThan(now, grant.expiresAt),
          );
        });

      return AuthorizationRequests.of({
        check: Effect.fn("AuthorizationRequests.check")(function* (params, userId) {
          const request = yield* validate(
            params,
            limiter.take([AttemptCounter.clientDocumentFetchesOfUser(userId)]),
          );

          const grant = yield* activeGrantOf(userId, request.aiClientId);

          return {
            aiClient: request.aiClient,
            redirectHost: request.redirectHost,
            loopbackOnly: request.loopbackOnly,
            permissions: request.permissions,
            grantablePermissions,
            grantedPermissions: Option.getOrNull(Option.map(grant, (held) => held.permissions)),
            consentRemembered:
              rememberConsent && Option.exists(grant, (held) => remembersConsent(held, request)),
          };
        }),
        approve: Effect.fn("AuthorizationRequests.approve")(function* (params, chosen, userId) {
          const request = yield* validate(params);

          const permissions = yield* Effect.fromOption(
            grantableOf(chosen),
            () =>
              new AuthorizationRequestRefused({
                error: "invalid_scope",
                error_description: `The approval must name some of: ${grantablePermissions.join(" ")}`,
              }),
          );

          const code = Base64Url.encode(yield* random.randomBytes(authorizationCodeBytes));
          const now = yield* DateTime.now;

          yield* grants.save({
            userId,
            aiClientId: request.aiClientId,
            aiClientName: request.aiClient.name,
            redirectUri: request.redirectUri,
            resource: request.resource,
            permissions,
            expiresAt: DateTime.addDuration(now, grantLifetime),
          });

          yield* codes.save({
            codeHash: yield* sha256Hex(digest, code),
            userId,
            aiClientId: request.aiClientId,
            aiClientName: request.aiClient.name,
            redirectUri: request.redirectUri,
            resource: request.resource,
            permissions,
            codeChallenge: request.codeChallenge,
            expiresAt: DateTime.addDuration(now, authorizationCodeLifetime),
          });

          return redirectOf(request, { code });
        }),
        deny: Effect.fn("AuthorizationRequests.deny")(function* (params) {
          return redirectOf(yield* validate(params), { error: "access_denied" });
        }),
      });
    }),
  );
}
