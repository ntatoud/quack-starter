import { MCP_PATH } from "@quack/contracts/api";
import type {
  AuthorizationRequest,
  AuthorizationRequestParams,
} from "@quack/contracts/oauth/authorization-request";
import { AuthorizationRequestRefused } from "@quack/contracts/oauth/oauth-errors";
import { Context, Effect, Layer } from "effect";

import { ServerConfig } from "#/config.ts";
import {
  AiClientDocuments,
  aiClientUrlOf,
  checkAuthorizationRequest,
} from "#/modules/identity/domain/ai-client.ts";

export class AuthorizationRequests extends Context.Service<
  AuthorizationRequests,
  {
    check(
      params: AuthorizationRequestParams,
    ): Effect.Effect<AuthorizationRequest, AuthorizationRequestRefused>;
  }
>()("@quack/server/identity/AuthorizationRequests") {
  static readonly layer = Layer.effect(
    AuthorizationRequests,
    Effect.gen(function* () {
      const documents = yield* AiClientDocuments;
      const issuer = yield* ServerConfig.publicOrigin;
      const server = {
        issuer,
        mcpResource: `${issuer}${MCP_PATH}`,
        allowLoopbackHttpDocuments: yield* ServerConfig.allowLoopbackHttpAiClients,
      };

      return AuthorizationRequests.of({
        check: Effect.fn("AuthorizationRequests.check")(function* (params) {
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
        }),
      });
    }),
  );
}
