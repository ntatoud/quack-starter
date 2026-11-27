import { NodeServices } from "@effect/platform-node";
import { Effect, Layer, Redacted } from "effect";

import { databaseAt } from "#/database/database.ts";
import { serverUrl, startPostgres } from "#/dev/dev-database.ts";
import {
  databaseUrl,
  onServer,
  type TestServer,
  testServerKey,
} from "#/modules/testing/lib/test-server.ts";

const reachable = (url: string) =>
  onServer(url, (sql) => sql`SELECT 1`).pipe(
    Effect.as(true),
    Effect.orElseSucceed(() => false),
  );

/** The server CI gives, or else the container of `compose.yaml`, started as `pnpm dev` starts it. */
const server = Effect.gen(function* () {
  const given = process.env["TEST_DATABASE_URL"];

  if (given !== undefined && given !== "") return given;
  const local = `${serverUrl}/postgres`;

  if (!(yield* reachable(local))) yield* startPostgres(process.env);

  return local;
});

const migrateTemplate = Effect.gen(function* () {
  const url = yield* server;
  const template = `quack_test_${crypto.randomUUID().slice(0, 8)}`;

  yield* onServer(url, (sql) => sql`CREATE DATABASE ${sql(template)}`);
  // Built, then released: a template takes no connection while it is cloned.
  yield* Layer.build(
    databaseAt({ url: Redacted.make(databaseUrl(url, template)), maxConnections: 1 }),
  ).pipe(Effect.scoped);

  return { url, template } satisfies TestServer;
});

// The clones a test left behind, if its run was cut short, go with the template.
const dropAll = ({ url, template }: TestServer) =>
  onServer(url, (sql) =>
    Effect.gen(function* () {
      const databases = yield* sql<{ readonly datname: string }>`
        SELECT datname FROM pg_database WHERE datname LIKE ${`${template}%`}`;

      for (const { datname } of databases) {
        yield* sql`DROP DATABASE IF EXISTS ${sql(datname)} WITH (FORCE)`;
      }
    }),
  );

export default async function setup(project: { provide: (key: never, value: TestServer) => void }) {
  const testServer = await Effect.runPromise(
    migrateTemplate.pipe(Effect.provide(NodeServices.layer)),
  );

  project.provide(testServerKey as never, testServer);

  return () => Effect.runPromise(dropAll(testServer));
}
