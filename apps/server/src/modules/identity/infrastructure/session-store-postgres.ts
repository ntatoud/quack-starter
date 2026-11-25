import { UserId } from "@quack/contracts/identity/user";
import { Effect, Layer, Schema, Struct } from "effect";
import { executor } from "@quack/effect-kysely/kysely";
import { SqlSchema } from "effect/sql";

import { db } from "#/database/db.ts";

import { SessionStore } from "#/modules/identity/domain/session-store.ts";

const SessionRow = Schema.Struct({
  tokenHash: Schema.String,
  userId: UserId,
  expiresAt: Schema.DateTimeUtcFromDate,
});

export const SessionStorePostgres = Layer.effect(
  SessionStore,
  Effect.gen(function* () {
    const execute = yield* executor;

    const insert = SqlSchema.void({
      Request: SessionRow,
      execute: (session) => execute(db.insertInto("sessions").values(session)),
    });

    const extend = SqlSchema.void({
      Request: SessionRow.mapFields(Struct.pick(["tokenHash", "expiresAt"])),
      execute: ({ tokenHash, expiresAt }) =>
        execute(db.updateTable("sessions").set({ expiresAt }).where("tokenHash", "=", tokenHash)),
    });

    const findByTokenHash = SqlSchema.findOneOption({
      Request: Schema.String,
      Result: SessionRow,
      execute: (tokenHash) =>
        execute(
          db
            .selectFrom("sessions")
            .select(["tokenHash", "userId", "expiresAt"])
            .where("tokenHash", "=", tokenHash),
        ),
    });

    const remove = SqlSchema.void({
      Request: Schema.String,
      execute: (tokenHash) => execute(db.deleteFrom("sessions").where("tokenHash", "=", tokenHash)),
    });

    const removeAllOf = SqlSchema.void({
      Request: UserId,
      execute: (userId) => execute(db.deleteFrom("sessions").where("userId", "=", userId)),
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
