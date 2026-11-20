import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    CREATE TABLE todos (
      id uuid CONSTRAINT todos_pkey PRIMARY KEY,
      owner_id uuid NOT NULL CONSTRAINT todos_owner_id_fkey REFERENCES users ON DELETE CASCADE,
      title text NOT NULL,
      completed boolean NOT NULL,
      created_at timestamptz NOT NULL
    )
  `;
  yield* sql`CREATE INDEX todos_owner_id_idx ON todos (owner_id)`;
});

export const down = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`DROP TABLE todos`;
});
