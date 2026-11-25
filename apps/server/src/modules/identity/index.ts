import { NodeCrypto } from "@effect/platform-node";
import { Layer } from "effect";

import { AuthorizationRequests } from "#/modules/identity/application/authorization-requests.ts";
import { Grants } from "#/modules/identity/application/grants.ts";
import { Identity } from "#/modules/identity/application/identity.ts";
import { Onboarding } from "#/modules/identity/application/onboarding.ts";
import { PasswordResets } from "#/modules/identity/application/password-resets.ts";
import { devAccountIds, IdentitySeed } from "#/modules/identity/application/identity-seed.ts";
import { Users } from "#/modules/identity/application/users.ts";
import { AuthenticationMiddleware } from "#/modules/identity/http/authentication-middleware.ts";
import { accessTo } from "#/modules/identity/http/authorize.ts";
import { McpCaller } from "#/modules/identity/http/mcp-caller.ts";
import { CsrfTokens } from "#/modules/identity/http/csrf-tokens.ts";
import { GrantsHandlers } from "#/modules/identity/http/grants-handlers.ts";
import { IdentityHandlers } from "#/modules/identity/http/identity-handlers.ts";
import { OAuthHandlers } from "#/modules/identity/http/oauth-handlers.ts";
import { OAuthMetadataRoutes } from "#/modules/identity/http/oauth-metadata.ts";
import { localAuthRequest } from "#/modules/identity/domain/app-auth.ts";
import { withAppAuthRequests } from "#/modules/identity/http/app-auth-http.ts";
import { TokenEndpointHeaders } from "#/modules/identity/http/token-endpoint-headers.ts";
import { UsersHandlers } from "#/modules/identity/http/users-handlers.ts";
import { AiClientDocumentsHttp } from "#/modules/identity/infrastructure/ai-client-documents-http.ts";
import { AiClientHttpClient } from "#/modules/identity/infrastructure/ai-client-http-client.ts";
import { AuthorizationCodeStorePostgres } from "#/modules/identity/infrastructure/authorization-code-store-postgres.ts";
import { GrantStorePostgres } from "#/modules/identity/infrastructure/grant-store-postgres.ts";
import { LinkTokenStorePostgres } from "#/modules/identity/infrastructure/link-token-store-postgres.ts";
import { AppAuthPostgres } from "#/modules/identity/infrastructure/app-auth-postgres.ts";
import { AttemptLimiterMemory } from "#/modules/identity/infrastructure/attempt-limiter-memory.ts";
import { PasswordCredentialsPostgres } from "#/modules/identity/infrastructure/password-credentials-postgres.ts";
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
  localAuthRequest,
  withAppAuthRequests,
};

/** With `AppAuth`, which Yielded Auth stores in Postgres too. */
export const IdentityPostgres = Layer.mergeAll(
  UserRepositoryPostgres,
  PasswordCredentialsPostgres,
  AuthorizationCodeStorePostgres,
  GrantStorePostgres,
  LinkTokenStorePostgres,
).pipe(Layer.provideMerge(AppAuthPostgres));

export const IdentityModule = Layer.mergeAll(IdentityHandlers, UsersHandlers).pipe(
  Layer.provideMerge(AuthenticationMiddleware),
  Layer.provide([Identity.layer, Users.layer, Onboarding.layer, PasswordResets.layer]),
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
