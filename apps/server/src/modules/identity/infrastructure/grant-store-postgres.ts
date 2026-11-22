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

    const findByRefreshToken = SqlSchema.findOneOption({
      Request: Schema.String,
      Result: GrantWithRefreshTokenRow,
      execute: (tokenHash) => sql`
        SELECT grants.*, token.token_hash AS refresh_token_hash,
          token.resource AS refresh_token_resource, token.permissions AS refresh_token_permissions,
          token.replaced AS refresh_token_replaced
        FROM grant_refresh_tokens AS token JOIN grants ON grants.id = token.grant_id
        WHERE token.token_hash = ${tokenHash}
      `,
    });

    // Locks the Grant before the token: a revocation, which deletes the Grant first, then waits for the
    // rotation to end instead of deadlocking with it.
    const lockGrant = SqlSchema.findAll({
      Request: Schema.String,
      Result: Schema.Struct({ id: Schema.String }),
      execute: (id) => sql`SELECT id FROM grants WHERE id = ${id} FOR NO KEY UPDATE`,
    });

    const markReplaced = SqlSchema.findAll({
      Request: RefreshTokenRow.mapFields(Struct.pick(["tokenHash", "grantId"])),
      Result: Schema.Struct({ tokenHash: Schema.String }),
      execute: ({ tokenHash, grantId }) => sql`
        UPDATE grant_refresh_tokens SET replaced = true
        WHERE token_hash = ${tokenHash} AND grant_id = ${grantId} AND NOT replaced
        RETURNING token_hash
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
      findByRefreshToken: Effect.fn("GrantStore.findByRefreshToken")((tokenHash) =>
        findByRefreshToken(tokenHash).pipe(
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
      rotateRefreshToken: Effect.fn("GrantStore.rotateRefreshToken")(
        (tokenHash, { accessToken, refreshToken, grantExpiresAt }) => {
          const grantId = refreshToken.grantId;

          return Effect.gen(function* () {
            if ((yield* lockGrant(grantId)).length === 0) return false;

            if ((yield* markReplaced({ tokenHash, grantId })).length === 0) return false;

            yield* insertAccessToken(accessToken);
            yield* insertRefreshToken(refreshToken);
            yield* extend({ id: grantId, expiresAt: grantExpiresAt });

            return true;
          }).pipe(sql.withTransaction, Effect.orDie);
        },
      ),
      revoke: Effect.fn("GrantStore.revoke")((id) => revoke(id).pipe(Effect.orDie)),
    });
  }),
);
