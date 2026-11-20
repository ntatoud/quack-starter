import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    CREATE TABLE sessions (
      token_hash text CONSTRAINT sessions_pkey PRIMARY KEY,
      user_id uuid NOT NULL
        CONSTRAINT sessions_user_id_fkey REFERENCES users ON DELETE CASCADE,
      expires_at timestamptz NOT NULL
    )
  `;
  yield* sql`CREATE INDEX sessions_user_id_idx ON sessions (user_id)`;
});

export const down = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`DROP TABLE sessions`;
});
