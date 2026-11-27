import { UserId } from "@quack/contracts/identity/user";
import { Permission } from "@quack/contracts/permission";
import { Effect, Layer, Option, Schema, Struct } from "effect";
import { executor } from "@quack/effect-kysely/kysely";
import { SqlClient, SqlSchema } from "effect/sql";

import { db, isStorableId } from "#/database/db.ts";

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
  lastUsedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
});

const GrantDraftRow = GrantRow.mapFields(Struct.omit(["id", "lastUsedAt"]));

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

export const GrantStorePostgres = Layer.effect(
  GrantStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const execute = yield* executor;

    const grantColumns = [
      "id",
      "userId",
      "aiClientId",
      "aiClientName",
      "redirectUri",
      "resource",
      "permissions",
      "expiresAt",
      "lastUsedAt",
    ] as const;

    const upsert = SqlSchema.findOne({
      Request: GrantDraftRow,
      Result: GrantRow,
      // One statement, so no token outlives the terms it was given under.
      execute: (draft) =>
        execute(
          db
            .with("saved", (query) =>
              query
                .insertInto("grants")
                .values(draft)
                .onConflict((conflict) =>
                  conflict.constraint("grants_user_id_ai_client_id_key").doUpdateSet((eb) => ({
                    aiClientName: eb.ref("excluded.aiClientName"),
                    redirectUri: eb.ref("excluded.redirectUri"),
                    resource: eb.ref("excluded.resource"),
                    permissions: eb.ref("excluded.permissions"),
                    expiresAt: eb.ref("excluded.expiresAt"),
                  })),
                )
                .returning(grantColumns),
            )
            .with("revoked_access", (query) =>
              query
                .deleteFrom("grantAccessTokens")
                .where("grantId", "in", (eb) => eb.selectFrom("saved").select("id")),
            )
            .with("revoked_refresh", (query) =>
              query
                .deleteFrom("grantRefreshTokens")
                .where("grantId", "in", (eb) => eb.selectFrom("saved").select("id")),
            )
            .selectFrom("saved")
            .select(grantColumns),
        ),
    });

    const findOf = SqlSchema.findOneOption({
      Request: GrantDraftRow.mapFields(Struct.pick(["userId", "aiClientId"])),
      Result: GrantRow,
      execute: ({ userId, aiClientId }) =>
        execute(
          db
            .selectFrom("grants")
            .select(grantColumns)
            .where("userId", "=", userId)
            .where("aiClientId", "=", aiClientId),
        ),
    });

    const listOf = SqlSchema.findAll({
      Request: UserId,
      Result: GrantRow,
      execute: (userId) =>
        execute(
          db
            .selectFrom("grants")
            .select(grantColumns)
            .where("userId", "=", userId)
            .orderBy("lastUsedAt", (order) => order.desc().nullsLast())
            .orderBy("id"),
        ),
    });

    const markUsed = SqlSchema.void({
      Request: GrantRow.mapFields(Struct.pick(["id", "lastUsedAt"])),
      execute: ({ id, lastUsedAt }) =>
        execute(db.updateTable("grants").set({ lastUsedAt }).where("id", "=", id)),
    });

    const insertAccessToken = SqlSchema.void({
      Request: AccessTokenRow,
      execute: (token) => execute(db.insertInto("grantAccessTokens").values(token)),
    });

    const findByAccessToken = SqlSchema.findOneOption({
      Request: Schema.String,
      Result: GrantWithAccessTokenRow,
      execute: (tokenHash) =>
        execute(
          db
            .selectFrom("grantAccessTokens as token")
            .innerJoin("grants", "grants.id", "token.grantId")
            .selectAll("grants")
            .select([
              "token.tokenHash as accessTokenHash",
              "token.resource as accessTokenResource",
              "token.permissions as accessTokenPermissions",
              "token.expiresAt as accessTokenExpiresAt",
            ])
            .where("token.tokenHash", "=", tokenHash),
        ),
    });

    const insertRefreshToken = SqlSchema.void({
      Request: RefreshTokenRow,
      execute: (token) => execute(db.insertInto("grantRefreshTokens").values(token)),
    });

    const findByRefreshToken = SqlSchema.findOneOption({
      Request: Schema.String,
      Result: GrantWithRefreshTokenRow,
      execute: (tokenHash) =>
        execute(
          db
            .selectFrom("grantRefreshTokens as token")
            .innerJoin("grants", "grants.id", "token.grantId")
            .selectAll("grants")
            .select([
              "token.tokenHash as refreshTokenHash",
              "token.resource as refreshTokenResource",
              "token.permissions as refreshTokenPermissions",
              "token.replaced as refreshTokenReplaced",
            ])
            .where("token.tokenHash", "=", tokenHash),
        ),
    });

    // Locks the Grant before the token: a revocation, which deletes the Grant first, then waits for the
    // rotation to end instead of deadlocking with it.
    const lockGrant = SqlSchema.findAll({
      Request: Schema.String,
      Result: Schema.Struct({ id: Schema.String }),
      execute: (id) =>
        execute(db.selectFrom("grants").select("id").where("id", "=", id).forNoKeyUpdate()),
    });

    const markReplaced = SqlSchema.findAll({
      Request: RefreshTokenRow.mapFields(Struct.pick(["tokenHash", "grantId"])),
      Result: Schema.Struct({ tokenHash: Schema.String }),
      execute: ({ tokenHash, grantId }) =>
        execute(
          db
            .updateTable("grantRefreshTokens")
            .set({ replaced: true })
            .where("tokenHash", "=", tokenHash)
            .where("grantId", "=", grantId)
            .where("replaced", "=", false)
            .returning("tokenHash"),
        ),
    });

    const extend = SqlSchema.void({
      Request: GrantRow.mapFields(Struct.pick(["id", "expiresAt"])),
      execute: ({ id, expiresAt }) =>
        execute(db.updateTable("grants").set({ expiresAt }).where("id", "=", id)),
    });

    const changePermissionsOf = SqlSchema.findOneOption({
      Request: GrantRow.mapFields(Struct.pick(["id", "userId", "permissions"])),
      Result: GrantRow,
      // One statement, so no token keeps the Permissions the Grant had.
      execute: ({ id, userId, permissions }) =>
        execute(
          db
            .with("changed", (query) =>
              query
                .updateTable("grants")
                .set({ permissions })
                .where("id", "=", id)
                .where("userId", "=", userId)
                .returning(grantColumns),
            )
            .with("access", (query) =>
              query
                .updateTable("grantAccessTokens")
                .set({ permissions })
                .where("grantId", "in", (eb) => eb.selectFrom("changed").select("id")),
            )
            .with("refresh", (query) =>
              query
                .updateTable("grantRefreshTokens")
                .set({ permissions })
                .where("grantId", "in", (eb) => eb.selectFrom("changed").select("id")),
            )
            .selectFrom("changed")
            .select(grantColumns),
        ),
    });

    const revoke = SqlSchema.void({
      Request: Schema.String,
      execute: (id) => execute(db.deleteFrom("grants").where("id", "=", id)),
    });

    const revokeOf = SqlSchema.findAll({
      Request: GrantRow.mapFields(Struct.pick(["id", "userId"])),
      Result: Schema.Struct({ id: Schema.String }),
      execute: ({ id, userId }) =>
        execute(
          db.deleteFrom("grants").where("id", "=", id).where("userId", "=", userId).returning("id"),
        ),
    });

    return GrantStore.of({
      save: Effect.fn("GrantStore.save")((draft) => upsert(draft).pipe(Effect.orDie)),
      findOf: Effect.fn("GrantStore.findOf")((userId, aiClientId) =>
        isStorableId(userId)
          ? findOf({ userId, aiClientId }).pipe(Effect.orDie)
          : Effect.succeedNone,
      ),
      listOf: Effect.fn("GrantStore.listOf")((userId) =>
        isStorableId(userId) ? listOf(userId).pipe(Effect.orDie) : Effect.succeed([]),
      ),
      markUsed: Effect.fn("GrantStore.markUsed")((id, lastUsedAt) =>
        markUsed({ id, lastUsedAt }).pipe(Effect.orDie),
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
      changePermissionsOf: Effect.fn("GrantStore.changePermissionsOf")((userId, id, permissions) =>
        isStorableId(userId) && isStorableId(id)
          ? changePermissionsOf({ id, userId, permissions }).pipe(Effect.orDie)
          : Effect.succeedNone,
      ),
      revoke: Effect.fn("GrantStore.revoke")((id) => revoke(id).pipe(Effect.orDie)),
      revokeOf: Effect.fn("GrantStore.revokeOf")((userId, id) =>
        isStorableId(userId) && isStorableId(id)
          ? revokeOf({ id, userId }).pipe(
              Effect.map((revoked) => revoked.length > 0),
              Effect.orDie,
            )
          : Effect.succeed(false),
      ),
    });
  }),
);
