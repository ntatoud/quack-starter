import { NodeCrypto } from "@effect/platform-node";
import { Layer } from "effect";

import { Identity } from "#/modules/identity/application/identity.ts";
import { AuthenticationMiddleware } from "#/modules/identity/http/authentication-middleware.ts";
import { IdentityHandlers } from "#/modules/identity/http/identity-handlers.ts";
import { SessionCookie } from "#/modules/identity/http/session-cookie.ts";
import { PasswordHasherArgon2 } from "#/modules/identity/infrastructure/password-hasher-argon2.ts";
import { SessionStoreMemory } from "#/modules/identity/infrastructure/session-store-memory.ts";
import { UserRepositoryMemory } from "#/modules/identity/infrastructure/user-repository-memory.ts";

/**
 * Composition of the identity context: handlers, use cases, and the chosen adapters.
 *
 * It also provides the implementation of the contract's `Authentication` middleware, for every group
 * that declares it: another module depends on the contract, never on this one.
 */
export const IdentityModule = IdentityHandlers.pipe(
  Layer.provideMerge(AuthenticationMiddleware),
  Layer.provide([Identity.layer, SessionCookie.layer]),
  Layer.provide([UserRepositoryMemory, SessionStoreMemory, PasswordHasherArgon2]),
  // Random bytes, SHA-256, and Argon2id, from node:crypto.
  Layer.provide([NodeCrypto.layerSecureRandom, NodeCrypto.layerDigest, NodeCrypto.layerKdf]),
);
