import { NodeCrypto } from "@effect/platform-node";
import { Layer } from "effect";

import { AuthorizationRequests } from "#/modules/identity/application/authorization-requests.ts";
import { Grants } from "#/modules/identity/application/grants.ts";
import { EmailChanges } from "#/modules/identity/application/email-changes.ts";
import { Identity } from "#/modules/identity/application/identity.ts";
import { PasswordResets } from "#/modules/identity/application/password-resets.ts";
import { AuthenticationMiddleware } from "#/modules/identity/http/authentication-middleware.ts";
import { accessTo } from "#/modules/identity/http/authorize.ts";
import { McpCaller } from "#/modules/identity/http/mcp-caller.ts";
import { CsrfTokens } from "#/modules/identity/http/csrf-tokens.ts";
import { GrantsHandlers } from "#/modules/identity/http/grants-handlers.ts";
import { IdentityHandlers } from "#/modules/identity/http/identity-handlers.ts";
import { OAuthHandlers } from "#/modules/identity/http/oauth-handlers.ts";
import { OAuthMetadataRoutes } from "#/modules/identity/http/oauth-metadata.ts";
import { SessionCookie } from "#/modules/identity/http/session-cookie.ts";
import { TokenEndpointHeaders } from "#/modules/identity/http/token-endpoint-headers.ts";
import { AiClientDocumentsHttp } from "#/modules/identity/infrastructure/ai-client-documents-http.ts";
import { AiClientHttpClient } from "#/modules/identity/infrastructure/ai-client-http-client.ts";
import { AuthorizationCodeStorePostgres } from "#/modules/identity/infrastructure/authorization-code-store-postgres.ts";
import { GrantStorePostgres } from "#/modules/identity/infrastructure/grant-store-postgres.ts";
import { LinkTokenStorePostgres } from "#/modules/identity/infrastructure/link-token-store-postgres.ts";
import { AttemptLimiterMemory } from "#/modules/identity/infrastructure/attempt-limiter-memory.ts";
import { SessionStorePostgres } from "#/modules/identity/infrastructure/session-store-postgres.ts";

export {
  accessTo,
  AiClientHttpClient,
  Grants,
  McpCaller,
  OAuthMetadataRoutes,
  TokenEndpointHeaders,
};

export const IdentityPostgres = Layer.mergeAll(
  SessionStorePostgres,
  AuthorizationCodeStorePostgres,
  GrantStorePostgres,
  LinkTokenStorePostgres,
);

/** The identity endpoints and the `Authentication` middleware. Requires `Users` (`UsersModule`) and its storage. */
export const IdentityModule = IdentityHandlers.pipe(
  Layer.provideMerge(AuthenticationMiddleware),
  Layer.provide([Identity.layer, PasswordResets.layer, EmailChanges.layer, SessionCookie.layer]),
  Layer.provide(AttemptLimiterMemory),
  Layer.provide([NodeCrypto.layerSecureRandom, NodeCrypto.layerDigest]),
);

/**
 * What AI Clients go through to act for a User, and the Grants the User sees and revokes. Requires the
 * `HttpClient` it fetches their documents with (`AiClientHttpClient`), and its storage, which `IdentityPostgres`
 * holds.
 */
export const AiClientsModule = Layer.mergeAll(OAuthHandlers, GrantsHandlers).pipe(
  Layer.provide([AuthorizationRequests.layer, CsrfTokens.layer]),
  Layer.provideMerge(Grants.layer),
  Layer.provide([AiClientDocumentsHttp, AttemptLimiterMemory]),
  Layer.provide([NodeCrypto.layerSecureRandom, NodeCrypto.layerDigest]),
);
