import { UserId } from "@quack/contracts/identity/user";
import { Permission } from "@quack/contracts/permission";
import { Effect, Layer, Option, Schema, Struct } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";

import { GrantStore } from "#/modules/identity/domain/grant-store.ts";

const GrantRow = Schema.Struct({
  id: Schema.String,
  userId: UserId,
  aiClientId: Schema.String,
  aiClientName: Schema.String,
  redirectUri: Schema.String,
  resource: Schema.String,
  permissions: Schema.Array(Permission),
  expiresAt: Schema.DateTimeUtcFromDate,
});

const GrantDraftRow = GrantRow.mapFields(Struct.omit(["id"]));

const AccessTokenRow = Schema.Struct({
  tokenHash: Schema.String,
  grantId: Schema.String,
  resource: Schema.String,
  permissions: Schema.Array(Permission),
  expiresAt: Schema.DateTimeUtcFromDate,
});

// One row of the join: the Grant's columns, and its token's under an `access_token_` prefix.
const GrantWithAccessTokenRow = Schema.Struct({
  ...GrantRow.fields,
  accessTokenHash: Schema.String,
  accessTokenResource: Schema.String,
  accessTokenPermissions: Schema.Array(Permission),
  accessTokenExpiresAt: Schema.DateTimeUtcFromDate,
});

// An id that is no uuid finds no User: Postgres would refuse to compare it with the column, and fail the request.
const isStorableId = Schema.is(Schema.String.check(Schema.isUUID()));

export const GrantStorePostgres = Layer.effect(
  GrantStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const grantColumns = sql`id, user_id, ai_client_id, ai_client_name, redirect_uri, resource, permissions, expires_at`;

    const upsert = SqlSchema.findOne({
      Request: GrantDraftRow,
      Result: GrantRow,
      execute: (draft) => sql`
        INSERT INTO grants ${sql.insert(draft)}
        ON CONFLICT ON CONSTRAINT grants_user_id_ai_client_id_key DO UPDATE SET
          ai_client_name = EXCLUDED.ai_client_name,
          redirect_uri = EXCLUDED.redirect_uri,
          resource = EXCLUDED.resource,
          permissions = EXCLUDED.permissions,
          expires_at = EXCLUDED.expires_at
        RETURNING ${grantColumns}
      `,
    });

    const findOf = SqlSchema.findOneOption({
      Request: GrantDraftRow.mapFields(Struct.pick(["userId", "aiClientId"])),
      Result: GrantRow,
      execute: ({ userId, aiClientId }) => sql`
        SELECT ${grantColumns} FROM grants
        WHERE user_id = ${userId} AND ai_client_id = ${aiClientId}
      `,
    });

    const insertAccessToken = SqlSchema.void({
      Request: AccessTokenRow,
      execute: (token) => sql`INSERT INTO grant_access_tokens ${sql.insert(token)}`,
    });

    const findByAccessToken = SqlSchema.findOneOption({
      Request: Schema.String,
      Result: GrantWithAccessTokenRow,
      execute: (tokenHash) => sql`
        SELECT grants.*, token.token_hash AS access_token_hash,
          token.resource AS access_token_resource, token.permissions AS access_token_permissions,
          token.expires_at AS access_token_expires_at
        FROM grant_access_tokens AS token JOIN grants ON grants.id = token.grant_id
        WHERE token.token_hash = ${tokenHash}
      `,
    });

    return GrantStore.of({
      save: Effect.fn("GrantStore.save")((draft) => upsert(draft).pipe(Effect.orDie)),
      findOf: Effect.fn("GrantStore.findOf")((userId, aiClientId) =>
        isStorableId(userId)
          ? findOf({ userId, aiClientId }).pipe(Effect.orDie)
          : Effect.succeedNone,
      ),
      saveAccessToken: Effect.fn("GrantStore.saveAccessToken")((token) =>
        insertAccessToken(token).pipe(Effect.orDie),
      ),
      findByAccessToken: Effect.fn("GrantStore.findByAccessToken")((tokenHash) =>
        findByAccessToken(tokenHash).pipe(
          Effect.map(
            Option.map(
              ({
                accessTokenHash,
                accessTokenResource,
                accessTokenPermissions,
                accessTokenExpiresAt,
                ...grant
              }) => ({
                grant,
                accessToken: {
                  tokenHash: accessTokenHash,
                  grantId: grant.id,
                  resource: accessTokenResource,
                  permissions: accessTokenPermissions,
                  expiresAt: accessTokenExpiresAt,
                },
              }),
            ),
          ),
          Effect.orDie,
        ),
      ),
    });
  }),
);
