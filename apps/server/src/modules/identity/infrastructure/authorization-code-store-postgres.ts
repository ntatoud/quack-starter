import { UserId } from "@quack/contracts/identity/user";
import { Permission } from "@quack/contracts/permission";
import { Effect, Layer, Schema } from "effect";
import { executor } from "@quack/effect-kysely/kysely";
import { SqlSchema } from "effect/sql";

import { db } from "#/database/db.ts";

import { AuthorizationCodeStore } from "#/modules/identity/domain/authorization-code-store.ts";

const AuthorizationCodeRow = Schema.Struct({
  codeHash: Schema.String,
  userId: UserId,
  aiClientId: Schema.String,
  aiClientName: Schema.String,
  redirectUri: Schema.String,
  resource: Schema.String,
  permissions: Schema.Array(Permission),
  codeChallenge: Schema.String,
  expiresAt: Schema.DateTimeUtcFromDate,
});

export const AuthorizationCodeStorePostgres = Layer.effect(
  AuthorizationCodeStore,
  Effect.gen(function* () {
    const execute = yield* executor;

    const insert = SqlSchema.void({
      Request: AuthorizationCodeRow,
      execute: (code) => execute(db.insertInto("authorizationCodes").values(code)),
    });

    // One statement finds and removes the code, so two exchanges of it never both find it.
    const take = SqlSchema.findOneOption({
      Request: Schema.String,
      Result: AuthorizationCodeRow,
      execute: (codeHash) =>
        execute(
          db.deleteFrom("authorizationCodes").where("codeHash", "=", codeHash).returningAll(),
        ),
    });

    return AuthorizationCodeStore.of({
      save: Effect.fn("AuthorizationCodeStore.save")((code) => insert(code).pipe(Effect.orDie)),
      take: Effect.fn("AuthorizationCodeStore.take")((codeHash) =>
        take(codeHash).pipe(Effect.orDie),
      ),
    });
  }),
);
