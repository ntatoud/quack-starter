import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    CREATE TABLE users (
      id uuid CONSTRAINT users_pkey PRIMARY KEY,
      email text NOT NULL CONSTRAINT users_email_key UNIQUE,
      password_hash text NOT NULL,
      role text NOT NULL,
      status text NOT NULL,
      created_at timestamptz NOT NULL,
      last_sign_in_at timestamptz,
      email_verified_at timestamptz
    )
  `;
});

export const down = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`DROP TABLE users`;
});
