import { UserRepositoryMemory } from "#/modules/identity/infrastructure/user-repository-memory.ts";
import { userRepositorySuite } from "#/modules/identity/testing/user-repository-suite.ts";

userRepositorySuite(UserRepositoryMemory);
