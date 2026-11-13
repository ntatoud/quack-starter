import { NodeCrypto } from "@effect/platform-node";
import { Layer } from "effect";

import { Identity } from "#/modules/identity/application/identity.ts";
import { IdentityHandlers } from "#/modules/identity/http/identity-handlers.ts";
import { PasswordHasherArgon2 } from "#/modules/identity/infrastructure/password-hasher-argon2.ts";
import { UserRepositoryMemory } from "#/modules/identity/infrastructure/user-repository-memory.ts";

/** Composition of the identity context: handlers, use cases, and the chosen adapters. */
export const IdentityModule = IdentityHandlers.pipe(
  Layer.provide(Identity.layer),
  Layer.provide([UserRepositoryMemory, PasswordHasherArgon2]),
  // Random salts and Argon2id, from node:crypto.
  Layer.provide([NodeCrypto.layerSecureRandom, NodeCrypto.layerKdf]),
);
