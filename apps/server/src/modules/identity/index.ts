import { NodeCrypto } from "@effect/platform-node";
import { Layer } from "effect";

import { AuthorizationRequests } from "#/modules/identity/application/authorization-requests.ts";
import { Grants } from "#/modules/identity/application/grants.ts";
import { Identity } from "#/modules/identity/application/identity.ts";
import { Onboarding } from "#/modules/identity/application/onboarding.ts";
import { devAccountIds, IdentitySeed } from "#/modules/identity/application/identity-seed.ts";
import { Users } from "#/modules/identity/application/users.ts";
import { AuthenticationMiddleware } from "#/modules/identity/http/authentication-middleware.ts";
import { accessTo } from "#/modules/identity/http/authorize.ts";
import { McpCaller } from "#/modules/identity/http/mcp-caller.ts";
import { CsrfTokens } from "#/modules/identity/http/csrf-tokens.ts";
import { IdentityHandlers } from "#/modules/identity/http/identity-handlers.ts";
import { OAuthHandlers } from "#/modules/identity/http/oauth-handlers.ts";
import { OAuthMetadataRoutes } from "#/modules/identity/http/oauth-metadata.ts";
import { SessionCookie } from "#/modules/identity/http/session-cookie.ts";
import { TokenEndpointHeaders } from "#/modules/identity/http/token-endpoint-headers.ts";
import { UsersHandlers } from "#/modules/identity/http/users-handlers.ts";
import { AiClientDocumentsHttp } from "#/modules/identity/infrastructure/ai-client-documents-http.ts";
import { AiClientHttpClient } from "#/modules/identity/infrastructure/ai-client-http-client.ts";
import { AuthorizationCodeStorePostgres } from "#/modules/identity/infrastructure/authorization-code-store-postgres.ts";
import { GrantStorePostgres } from "#/modules/identity/infrastructure/grant-store-postgres.ts";
import { AttemptLimiterMemory } from "#/modules/identity/infrastructure/attempt-limiter-memory.ts";
import { PasswordHasherArgon2 } from "#/modules/identity/infrastructure/password-hasher-argon2.ts";
import { SessionStorePostgres } from "#/modules/identity/infrastructure/session-store-postgres.ts";
import { UserRepositoryPostgres } from "#/modules/identity/infrastructure/user-repository-postgres.ts";

export {
  accessTo,
  AiClientHttpClient,
  devAccountIds,
  Grants,
  IdentitySeed,
  McpCaller,
  OAuthMetadataRoutes,
  TokenEndpointHeaders,
};

export const IdentityPostgres = Layer.mergeAll(
  UserRepositoryPostgres,
  SessionStorePostgres,
  AuthorizationCodeStorePostgres,
  GrantStorePostgres,
);

export const IdentityModule = Layer.mergeAll(IdentityHandlers, UsersHandlers).pipe(
  Layer.provideMerge(AuthenticationMiddleware),
  Layer.provide([Identity.layer, Users.layer, Onboarding.layer, SessionCookie.layer]),
  Layer.provide([PasswordHasherArgon2, AttemptLimiterMemory]),
  Layer.provide([NodeCrypto.layerSecureRandom, NodeCrypto.layerDigest, NodeCrypto.layerKdf]),
);

/**
 * The authorization server AI Clients go through. Requires the `HttpClient` it fetches their documents with
 * (`AiClientHttpClient`), and its storage, which `IdentityPostgres` holds.
 */
export const OAuthModule = OAuthHandlers.pipe(
  Layer.provide([AuthorizationRequests.layer, CsrfTokens.layer]),
  Layer.provideMerge(Grants.layer),
  Layer.provide([AiClientDocumentsHttp, AttemptLimiterMemory]),
  Layer.provide([NodeCrypto.layerSecureRandom, NodeCrypto.layerDigest]),
);
