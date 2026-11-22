import type { UserId } from "@quack/contracts/identity/user";
import { MCP_PATH } from "@quack/contracts/api";
import type {
  AuthorizationRequestParams,
  ConsentDetails,
} from "@quack/contracts/oauth/authorization-request";
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
import {
  authorizationCodeBytes,
  authorizationCodeLifetime,
} from "#/modules/identity/domain/authorization-code.ts";
import { AuthorizationCodeStore } from "#/modules/identity/domain/authorization-code-store.ts";
import { type GrantTerms, remembersConsent } from "#/modules/identity/domain/grant.ts";

// Grants are not stored yet: until they are, no User has one to remember.
const activeGrantOf = (_userId: UserId, _aiClientId: string) =>
  Effect.succeed(Option.none<GrantTerms>());

export class AuthorizationRequests extends Context.Service<
  AuthorizationRequests,
  {
    check(
      params: AuthorizationRequestParams,
      userId: UserId,
    ): Effect.Effect<typeof ConsentDetails.Type, AuthorizationRequestRefused>;
    approve(
      params: AuthorizationRequestParams,
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
      const random = yield* SecureRandom.SecureRandom;
      const digest = yield* Digest.Digest;
      const issuer = yield* ServerConfig.publicOrigin;
      const rememberConsent = yield* ServerConfig.rememberConsent;

      const server = {
        issuer,
        mcpResource: `${issuer}${MCP_PATH}`,
        allowLoopbackHttpDocuments: yield* ServerConfig.allowLoopbackHttpAiClients,
      };

      const validate = Effect.fn("AuthorizationRequests.validate")(function* (
        params: AuthorizationRequestParams,
      ) {
        const url = yield* aiClientUrlOf(params.client_id, server);

        const document = yield* documents.fetch(url).pipe(
          Effect.mapError(
            ({ reason }) =>
              new AuthorizationRequestRefused({
                error: "invalid_client",
                error_description: `Could not fetch the AI Client's document: ${reason}`,
              }),
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

      return AuthorizationRequests.of({
        check: Effect.fn("AuthorizationRequests.check")(function* (params, userId) {
          const request = yield* validate(params);
          const grant = yield* activeGrantOf(userId, request.aiClientId);

          return {
            aiClient: request.aiClient,
            redirectHost: request.redirectHost,
            loopbackOnly: request.loopbackOnly,
            permissions: request.permissions,
            grantedPermissions: Option.getOrNull(Option.map(grant, (held) => held.permissions)),
            consentRemembered:
              rememberConsent && Option.exists(grant, (held) => remembersConsent(held, request)),
          };
        }),
        approve: Effect.fn("AuthorizationRequests.approve")(function* (params, userId) {
          const request = yield* validate(params);
          const code = Base64Url.encode(yield* random.randomBytes(authorizationCodeBytes));
          yield* codes.save({
            codeHash: yield* sha256Hex(digest, code),
            userId,
            aiClientId: request.aiClientId,
            aiClientName: request.aiClient.name,
            redirectUri: request.redirectUri,
            resource: request.resource,
            permissions: request.permissions,
            codeChallenge: request.codeChallenge,
            expiresAt: DateTime.addDuration(yield* DateTime.now, authorizationCodeLifetime),
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
