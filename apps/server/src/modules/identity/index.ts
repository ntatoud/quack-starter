import { NodeCrypto } from "@effect/platform-node";
import { Effect, Layer } from "effect";

import { ServerConfig } from "#/config.ts";

import { Identity } from "#/modules/identity/application/identity.ts";
import { devUsers, UserSeed } from "#/modules/identity/application/user-seed.ts";
import { Users } from "#/modules/identity/application/users.ts";
import { AuthenticationMiddleware } from "#/modules/identity/http/authentication-middleware.ts";
import { RequireRoleMiddleware } from "#/modules/identity/http/require-role-middleware.ts";
import { IdentityHandlers } from "#/modules/identity/http/identity-handlers.ts";
import { SessionCookie } from "#/modules/identity/http/session-cookie.ts";
import { UsersHandlers } from "#/modules/identity/http/users-handlers.ts";
import { AttemptLimiterMemory } from "#/modules/identity/infrastructure/attempt-limiter-memory.ts";
import { PasswordHasherArgon2 } from "#/modules/identity/infrastructure/password-hasher-argon2.ts";
import { SessionStoreMemory } from "#/modules/identity/infrastructure/session-store-memory.ts";
import { UserRepositoryMemory } from "#/modules/identity/infrastructure/user-repository-memory.ts";

const DevUserSeed = Layer.unwrap(
  Effect.map(ServerConfig, ({ seedUsers }) => (seedUsers ? UserSeed(devUsers) : Layer.empty)),
);

export const IdentityModule = Layer.mergeAll(IdentityHandlers, UsersHandlers).pipe(
  Layer.provideMerge([AuthenticationMiddleware, RequireRoleMiddleware]),
  Layer.provide([Identity.layer, Users.layer, SessionCookie.layer, DevUserSeed]),
  Layer.provide([
    UserRepositoryMemory,
    SessionStoreMemory,
    PasswordHasherArgon2,
    AttemptLimiterMemory,
  ]),
  Layer.provide([NodeCrypto.layerSecureRandom, NodeCrypto.layerDigest, NodeCrypto.layerKdf]),
);
