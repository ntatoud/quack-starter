import { UserId } from "@quack/contracts/identity/user";
import { Effect } from "effect";

import { SessionStoreMemory } from "#/modules/identity/testing/session-store-memory.ts";
import { sessionStoreSuite } from "#/modules/identity/testing/session-store-suite.ts";

sessionStoreSuite(
  SessionStoreMemory,
  Effect.sync(() => UserId.make(crypto.randomUUID())),
);
