import { UserId } from "@quack/contracts/identity/user";
import { Effect, Layer, Schema, Struct } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";

import { SessionStore } from "#/modules/identity/domain/session-store.ts";

const SessionRow = Schema.Struct({
  tokenHash: Schema.String,
  userId: UserId,
  expiresAt: Schema.DateTimeUtcFromDate,
});

export const SessionStorePostgres = Layer.effect(
  SessionStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const insert = SqlSchema.void({
      Request: SessionRow,
      execute: (session) => sql`INSERT INTO sessions ${sql.insert(session)}`,
    });

    const extend = SqlSchema.void({
      Request: SessionRow.mapFields(Struct.pick(["tokenHash", "expiresAt"])),
      execute: ({ tokenHash, expiresAt }) =>
        sql`UPDATE sessions SET expires_at = ${expiresAt} WHERE token_hash = ${tokenHash}`,
    });

    const findByTokenHash = SqlSchema.findOneOption({
      Request: Schema.String,
      Result: SessionRow,
      execute: (tokenHash) =>
        sql`SELECT token_hash, user_id, expires_at FROM sessions WHERE token_hash = ${tokenHash}`,
    });

    const remove = SqlSchema.void({
      Request: Schema.String,
      execute: (tokenHash) => sql`DELETE FROM sessions WHERE token_hash = ${tokenHash}`,
    });

    const removeAllOf = SqlSchema.void({
      Request: UserId,
      execute: (userId) => sql`DELETE FROM sessions WHERE user_id = ${userId}`,
    });

    return SessionStore.of({
      save: Effect.fn("SessionStore.save")((session) => insert(session).pipe(Effect.orDie)),
      extend: Effect.fn("SessionStore.extend")((tokenHash, expiresAt) =>
        extend({ tokenHash, expiresAt }).pipe(Effect.orDie),
      ),
      findByTokenHash: Effect.fn("SessionStore.findByTokenHash")((tokenHash) =>
        findByTokenHash(tokenHash).pipe(Effect.orDie),
      ),
      remove: Effect.fn("SessionStore.remove")((tokenHash) => remove(tokenHash).pipe(Effect.orDie)),
      removeAllOf: Effect.fn("SessionStore.removeAllOf")((userId) =>
        removeAllOf(userId).pipe(Effect.orDie),
      ),
    });
  }),
);
