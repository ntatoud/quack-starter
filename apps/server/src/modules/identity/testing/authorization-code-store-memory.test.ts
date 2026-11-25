import { UserId } from "@quack/contracts/identity/user";
import { Effect } from "effect";

import { AuthorizationCodeStoreMemory } from "#/modules/identity/testing/authorization-code-store-memory.ts";
import { authorizationCodeStoreSuite } from "#/modules/identity/testing/authorization-code-store-suite.ts";

authorizationCodeStoreSuite(
  AuthorizationCodeStoreMemory,
  Effect.sync(() => UserId.make(crypto.randomUUID())),
);
