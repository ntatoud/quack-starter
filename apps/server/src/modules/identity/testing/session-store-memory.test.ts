import { SessionStoreMemory } from "#/modules/identity/testing/session-store-memory.ts";
import { sessionStoreSuite } from "#/modules/identity/testing/session-store-suite.ts";

sessionStoreSuite(SessionStoreMemory);
