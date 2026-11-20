import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    CREATE TABLE user_profiles (
      user_id uuid CONSTRAINT user_profiles_pkey PRIMARY KEY
        CONSTRAINT user_profiles_user_id_fkey REFERENCES users ON DELETE CASCADE,
      first_name text NOT NULL,
      last_name text NOT NULL,
      job_title text NOT NULL,
      team text NOT NULL,
      country text NOT NULL,
      avatar_url text,
      tags text[] NOT NULL
    )
  `;
});

export const down = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`DROP TABLE user_profiles`;
});
