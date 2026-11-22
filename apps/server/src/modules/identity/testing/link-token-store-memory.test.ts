import { UserId } from "@quack/contracts/identity/user";
import { Effect } from "effect";

import { LinkTokenStoreMemory } from "#/modules/identity/testing/link-token-store-memory.ts";
import { linkTokenStoreSuite } from "#/modules/identity/testing/link-token-store-suite.ts";

linkTokenStoreSuite(
  LinkTokenStoreMemory,
  Effect.sync(() => UserId.make(crypto.randomUUID())),
);
