import { Layer } from "effect";

import { UserRepositoryPostgres } from "#/modules/identity/infrastructure/user-repository-postgres.ts";
import { userRepositorySuite } from "#/modules/identity/testing/user-repository-suite.ts";
import { TestDatabase } from "#/modules/testing/index.ts";

userRepositorySuite(UserRepositoryPostgres.pipe(Layer.provide(TestDatabase)));
