import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  // An enum sorts in the order of its labels: alphabetical, as the list of Users sorts by status.
  yield* sql`CREATE TYPE user_status AS ENUM ('active', 'invited', 'suspended')`;
  yield* sql`
    CREATE TABLE users (
      id uuid CONSTRAINT users_pkey PRIMARY KEY,
      email text NOT NULL CONSTRAINT users_email_key UNIQUE,
      password_hash text NOT NULL,
      role text NOT NULL,
      status user_status NOT NULL,
      created_at timestamptz NOT NULL,
      last_sign_in_at timestamptz,
      onboarded_at timestamptz
    )
  `;
});

export const down = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`DROP TABLE users`;
  yield* sql`DROP TYPE user_status`;
});
