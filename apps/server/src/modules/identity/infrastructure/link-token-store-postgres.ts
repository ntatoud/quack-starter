import { UserId } from "@quack/contracts/identity/user";
import { Effect, Layer, Schema, Struct } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";

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
    const sql = yield* SqlClient.SqlClient;

    // One statement replaces the User's link, so two requests at once still leave one.
    const upsert = SqlSchema.void({
      Request: LinkTokenRow,
      execute: (link) => sql`
        INSERT INTO link_tokens ${sql.insert(link)}
        ON CONFLICT ON CONSTRAINT link_tokens_user_id_purpose_key
        DO UPDATE SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at
      `,
    });

    // One statement finds and removes the link, so two requests with it never both find it.
    const take = SqlSchema.findOneOption({
      Request: LinkTokenRow.mapFields(Struct.pick(["tokenHash", "purpose"])),
      Result: LinkTokenRow,
      execute: ({ tokenHash, purpose }) => sql`
        DELETE FROM link_tokens WHERE token_hash = ${tokenHash} AND purpose = ${purpose}
        RETURNING token_hash, user_id, purpose, expires_at
      `,
    });

    return LinkTokenStore.of({
      save: Effect.fn("LinkTokenStore.save")((link) => upsert(link).pipe(Effect.orDie)),
      take: Effect.fn("LinkTokenStore.take")((tokenHash, purpose) =>
        take({ tokenHash, purpose }).pipe(Effect.orDie),
      ),
    });
  }),
);
