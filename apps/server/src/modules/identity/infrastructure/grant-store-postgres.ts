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

const RefreshTokenRow = Schema.Struct({
  tokenHash: Schema.String,
  grantId: Schema.String,
  resource: Schema.String,
  permissions: Schema.Array(Permission),
  replaced: Schema.Boolean,
});

// One row of the join: the Grant's columns, and its token's under an `access_token_` prefix.
const GrantWithAccessTokenRow = Schema.Struct({
  ...GrantRow.fields,
  accessTokenHash: Schema.String,
  accessTokenResource: Schema.String,
  accessTokenPermissions: Schema.Array(Permission),
  accessTokenExpiresAt: Schema.DateTimeUtcFromDate,
});

const GrantWithRefreshTokenRow = Schema.Struct({
  ...GrantRow.fields,
  refreshTokenHash: Schema.String,
  refreshTokenResource: Schema.String,
  refreshTokenPermissions: Schema.Array(Permission),
  refreshTokenReplaced: Schema.Boolean,
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

    const insertRefreshToken = SqlSchema.void({
      Request: RefreshTokenRow,
      execute: (token) => sql`INSERT INTO grant_refresh_tokens ${sql.insert(token)}`,
    });

    // The row is locked before it is read: a second caller waits, then reads it replaced. The join reads
    // the token from `found`, not the table, whose snapshot predates the wait.
    const replaceRefreshToken = SqlSchema.findOneOption({
      Request: Schema.String,
      Result: GrantWithRefreshTokenRow,
      execute: (tokenHash) => sql`
        WITH found AS (
          SELECT * FROM grant_refresh_tokens WHERE token_hash = ${tokenHash} FOR UPDATE
        ), replacing AS (
          UPDATE grant_refresh_tokens SET replaced = true
          WHERE token_hash IN (SELECT token_hash FROM found)
        )
        SELECT grants.*, found.token_hash AS refresh_token_hash,
          found.resource AS refresh_token_resource, found.permissions AS refresh_token_permissions,
          found.replaced AS refresh_token_replaced
        FROM found JOIN grants ON grants.id = found.grant_id
      `,
    });

    const extend = SqlSchema.void({
      Request: GrantRow.mapFields(Struct.pick(["id", "expiresAt"])),
      execute: ({ id, expiresAt }) =>
        sql`UPDATE grants SET expires_at = ${expiresAt} WHERE id = ${id}`,
    });

    const revoke = SqlSchema.void({
      Request: Schema.String,
      execute: (id) => sql`DELETE FROM grants WHERE id = ${id}`,
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
      saveRefreshToken: Effect.fn("GrantStore.saveRefreshToken")((token) =>
        insertRefreshToken(token).pipe(Effect.orDie),
      ),
      replaceRefreshToken: Effect.fn("GrantStore.replaceRefreshToken")((tokenHash) =>
        replaceRefreshToken(tokenHash).pipe(
          Effect.map(
            Option.map(
              ({
                refreshTokenHash,
                refreshTokenResource,
                refreshTokenPermissions,
                refreshTokenReplaced,
                ...grant
              }) => ({
                grant,
                refreshToken: {
                  tokenHash: refreshTokenHash,
                  grantId: grant.id,
                  resource: refreshTokenResource,
                  permissions: refreshTokenPermissions,
                  replaced: refreshTokenReplaced,
                },
              }),
            ),
          ),
          Effect.orDie,
        ),
      ),
      extend: Effect.fn("GrantStore.extend")((id, expiresAt) =>
        extend({ id, expiresAt }).pipe(Effect.orDie),
      ),
      revoke: Effect.fn("GrantStore.revoke")((id) => revoke(id).pipe(Effect.orDie)),
    });
  }),
);
