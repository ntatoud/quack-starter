import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    CREATE TABLE authorization_codes (
      code_hash text CONSTRAINT authorization_codes_pkey PRIMARY KEY,
      user_id uuid NOT NULL
        CONSTRAINT authorization_codes_user_id_fkey REFERENCES users ON DELETE CASCADE,
      ai_client_id text NOT NULL,
      ai_client_name text NOT NULL,
      redirect_uri text NOT NULL,
      resource text NOT NULL,
      permissions text[] NOT NULL,
      code_challenge text NOT NULL,
      expires_at timestamptz NOT NULL
    )
  `;
  yield* sql`CREATE INDEX authorization_codes_user_id_idx ON authorization_codes (user_id)`;
});

// The codes live a minute: dropping them loses nothing an AI Client could not ask for again.
export const down = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`DROP TABLE authorization_codes`;
});
