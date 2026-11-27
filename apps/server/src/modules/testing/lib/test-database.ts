import { PgClient } from "@effect/sql-pg";
import { Clock, Effect, Layer, Redacted, Schema, String } from "effect";
import { inject } from "vite-plus/test";

import {
  databaseUrl,
  onServer,
  TestServer,
  testServerKey,
} from "#/modules/testing/lib/test-server.ts";

/**
 * The URL of a database of its own, cloned from the template the global setup migrated, and dropped when the scope
 * closes: for a test of what connects by URL, such as the seed.
 */
export const testDatabaseUrl = Effect.gen(function* () {
  // `ProvidedContext` cannot be augmented from here: vitest is a dependency of vite-plus, not of the server.
  const { url, template } = yield* Schema.decodeEffect(TestServer)(inject(testServerKey as never));

  const name = `${template}_${crypto.randomUUID().replaceAll("-", "")}`;

  yield* Effect.acquireRelease(
    onServer(url, (sql) => sql`CREATE DATABASE ${sql(name)} TEMPLATE ${sql(template)}`),
    () =>
      onServer(url, (sql) => sql`DROP DATABASE IF EXISTS ${sql(name)} WITH (FORCE)`).pipe(
        Effect.orDie,
      ),
  );

  return databaseUrl(url, name);
}).pipe(Effect.orDie);

/**
 * A database of its own, cloned from the template the global setup migrated, and dropped when the Layer is released.
 * Each build is a fresh database: provide it to each test.
 */
export const TestDatabase = Layer.unwrap(
  Effect.map(testDatabaseUrl, (url) =>
    PgClient.layer({
      url: Redacted.make(url),
      maxConnections: 4,
      transformQueryNames: String.camelToSnake,
      transformResultNames: String.snakeToCamel,
    }).pipe(
      // A test that moves its TestClock would otherwise expire the pool's connections, and wait for new ones.
      Layer.provide(Layer.succeed(Clock.Clock, Clock.Clock.defaultValue())),
    ),
  ),
).pipe(Layer.orDie);
