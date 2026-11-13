import { NodeCrypto } from "@effect/platform-node";
import { Layer } from "effect";

import { Identity } from "#/modules/identity/application/identity.ts";
import { AuthenticationMiddleware } from "#/modules/identity/http/authentication-middleware.ts";
import { IdentityHandlers } from "#/modules/identity/http/identity-handlers.ts";
import { SessionCookie } from "#/modules/identity/http/session-cookie.ts";
import { AttemptLimiterMemory } from "#/modules/identity/infrastructure/attempt-limiter-memory.ts";
import { PasswordHasherArgon2 } from "#/modules/identity/infrastructure/password-hasher-argon2.ts";
import { SessionStoreMemory } from "#/modules/identity/infrastructure/session-store-memory.ts";
import { UserRepositoryMemory } from "#/modules/identity/infrastructure/user-repository-memory.ts";

export const IdentityModule = IdentityHandlers.pipe(
  Layer.provideMerge(AuthenticationMiddleware),
  Layer.provide([Identity.layer, SessionCookie.layer]),
  Layer.provide([
    UserRepositoryMemory,
    SessionStoreMemory,
    PasswordHasherArgon2,
    AttemptLimiterMemory,
  ]),
  Layer.provide([NodeCrypto.layerSecureRandom, NodeCrypto.layerDigest, NodeCrypto.layerKdf]),
);
