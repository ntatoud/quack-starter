import { UserId } from "@quack/contracts/identity/user";
import { Effect, Layer, Schema, Struct } from "effect";
import { executor } from "@quack/effect-kysely/kysely";
import { SqlSchema } from "effect/sql";

import { db } from "#/database/db.ts";

import { LinkPurpose } from "#/modules/identity/domain/link-token.ts";
import { LinkTokenStore } from "#/modules/identity/domain/link-token-store.ts";

const LinkTokenRow = Schema.Struct({
  tokenHash: Schema.String,
  userId: UserId,
  purpose: LinkPurpose,
  expiresAt: Schema.DateTimeUtcFromDate,
});

export const LinkTokenStorePostgres = Layer.effect(
  LinkTokenStore,
  Effect.gen(function* () {
    const execute = yield* executor;

    // One statement replaces the User's link, so two requests at once still leave one.
    const upsert = SqlSchema.void({
      Request: LinkTokenRow,
      execute: (link) =>
        execute(
          db
            .insertInto("linkTokens")
            .values(link)
            .onConflict((conflict) =>
              conflict.constraint("linkTokens_user_id_purpose_key").doUpdateSet((eb) => ({
                tokenHash: eb.ref("excluded.tokenHash"),
                expiresAt: eb.ref("excluded.expiresAt"),
              })),
            ),
        ),
    });

    // One statement finds and removes the link, so two requests with it never both find it.
    const take = SqlSchema.findOneOption({
      Request: LinkTokenRow.mapFields(Struct.pick(["tokenHash", "purpose"])),
      Result: LinkTokenRow,
      execute: ({ tokenHash, purpose }) =>
        execute(
          db
            .deleteFrom("linkTokens")
            .where("tokenHash", "=", tokenHash)
            .where("purpose", "=", purpose)
            .returningAll(),
        ),
    });

    return LinkTokenStore.of({
      save: Effect.fn("LinkTokenStore.save")((link) => upsert(link).pipe(Effect.orDie)),
      take: Effect.fn("LinkTokenStore.take")((tokenHash, purpose) =>
        take({ tokenHash, purpose }).pipe(Effect.orDie),
      ),
    });
  }),
);
