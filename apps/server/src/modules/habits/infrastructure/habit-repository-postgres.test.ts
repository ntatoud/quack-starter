import { UserId } from "@quack/contracts/identity/user";
import { Effect, Layer, Redacted } from "effect";
import { executor } from "@quack/effect-kysely/kysely";
import { describe } from "vite-plus/test";

import { databaseAt } from "#/database/database.ts";
import { db } from "#/database/db.ts";
import { HabitRepositoryPostgres } from "#/modules/habits/infrastructure/habit-repository-postgres.ts";
import { habitRepositorySuite } from "#/modules/habits/testing/habit-repository-suite.ts";

// A database of its own, which these tests migrate and fill: never one a server uses.
const url = process.env.TEST_DATABASE_URL;

// A row of `users` for the Habits to reference: the identity module stores Users, not this one.
const anOwner = Effect.gen(function* () {
  const execute = yield* executor;
  const id = UserId.make(crypto.randomUUID());

  yield* execute(
    db.insertInto("users").values({
      id,
      email: `${id}@example.com`,
      passwordHash: "not a hash",
      role: "user",
      status: "active",
      createdAt: new Date(),
      timeZone: "Europe/Paris",
    }),
  );

  return id;
}).pipe(Effect.orDie);

const Postgres = HabitRepositoryPostgres.pipe(
  Layer.provideMerge(databaseAt({ url: Redacted.make(url ?? ""), maxConnections: 2 })),
  Layer.orDie,
);

describe.skipIf(url === undefined)("HabitRepositoryPostgres", () => {
  habitRepositorySuite(Postgres, anOwner);
});
