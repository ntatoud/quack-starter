import { UserId } from "@quack/contracts/identity/user";
import { Effect } from "effect";

import { GrantStoreMemory } from "#/modules/identity/testing/grant-store-memory.ts";
import { grantStoreSuite } from "#/modules/identity/testing/grant-store-suite.ts";

grantStoreSuite(
  GrantStoreMemory,
  Effect.sync(() => UserId.make(crypto.randomUUID())),
);
