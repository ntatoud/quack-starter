import { NodeCrypto } from "@effect/platform-node";
import { Layer } from "effect";

import { Identity } from "#/modules/identity/application/identity.ts";
import { Onboarding } from "#/modules/identity/application/onboarding.ts";
import { devAccountIds, IdentitySeed } from "#/modules/identity/application/identity-seed.ts";
import { Users } from "#/modules/identity/application/users.ts";
import { AuthenticationMiddleware } from "#/modules/identity/http/authentication-middleware.ts";
import { IdentityHandlers } from "#/modules/identity/http/identity-handlers.ts";
import { SessionCookie } from "#/modules/identity/http/session-cookie.ts";
import { UsersHandlers } from "#/modules/identity/http/users-handlers.ts";
import { AttemptLimiterMemory } from "#/modules/identity/infrastructure/attempt-limiter-memory.ts";
import { PasswordHasherArgon2 } from "#/modules/identity/infrastructure/password-hasher-argon2.ts";
import { SessionStorePostgres } from "#/modules/identity/infrastructure/session-store-postgres.ts";
import { UserRepositoryPostgres } from "#/modules/identity/infrastructure/user-repository-postgres.ts";

export { devAccountIds, IdentitySeed };

export const IdentityPostgres = Layer.mergeAll(UserRepositoryPostgres, SessionStorePostgres);

export const IdentityModule = Layer.mergeAll(IdentityHandlers, UsersHandlers).pipe(
  Layer.provideMerge(AuthenticationMiddleware),
  Layer.provide([Identity.layer, Users.layer, Onboarding.layer, SessionCookie.layer]),
  Layer.provide([PasswordHasherArgon2, AttemptLimiterMemory]),
  Layer.provide([NodeCrypto.layerSecureRandom, NodeCrypto.layerDigest, NodeCrypto.layerKdf]),
);
