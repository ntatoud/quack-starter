import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  // One table for every link sent by email (a Password Reset, later an Email Change), told apart by `purpose`.
  yield* sql`
    CREATE TABLE link_tokens (
      token_hash text CONSTRAINT link_tokens_pkey PRIMARY KEY,
      user_id uuid NOT NULL
        CONSTRAINT link_tokens_user_id_fkey REFERENCES users ON DELETE CASCADE,
      purpose text NOT NULL,
      expires_at timestamptz NOT NULL
    )
  `;
  yield* sql`CREATE INDEX link_tokens_user_id_purpose_idx ON link_tokens (user_id, purpose)`;
});

// The links live an hour: dropping them loses nothing a User could not ask for again.
export const down = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`DROP TABLE link_tokens`;
});
