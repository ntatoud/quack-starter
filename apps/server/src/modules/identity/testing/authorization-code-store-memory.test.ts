import { AuthorizationCodeStoreMemory } from "#/modules/identity/testing/authorization-code-store-memory.ts";
import { authorizationCodeStoreSuite } from "#/modules/identity/testing/authorization-code-store-suite.ts";

authorizationCodeStoreSuite(AuthorizationCodeStoreMemory);
