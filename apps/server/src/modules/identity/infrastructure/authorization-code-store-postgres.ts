import { UserId } from "@quack/contracts/identity/user";
import { Permission } from "@quack/contracts/permission";
import { Effect, Layer, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";

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
    const sql = yield* SqlClient.SqlClient;

    const insert = SqlSchema.void({
      Request: AuthorizationCodeRow,
      execute: (code) => sql`INSERT INTO authorization_codes ${sql.insert(code)}`,
    });

    // One statement finds and removes the code, so two exchanges of it never both find it.
    const take = SqlSchema.findOneOption({
      Request: Schema.String,
      Result: AuthorizationCodeRow,
      execute: (codeHash) => sql`
        DELETE FROM authorization_codes WHERE code_hash = ${codeHash}
        RETURNING code_hash, user_id, ai_client_id, ai_client_name, redirect_uri, resource,
          permissions, code_challenge, expires_at
      `,
    });

    return AuthorizationCodeStore.of({
      save: Effect.fn("AuthorizationCodeStore.save")((code) => insert(code).pipe(Effect.orDie)),
      take: Effect.fn("AuthorizationCodeStore.take")((codeHash) =>
        take(codeHash).pipe(Effect.orDie),
      ),
    });
  }),
);
