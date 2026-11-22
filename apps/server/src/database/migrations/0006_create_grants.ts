import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    CREATE TABLE grants (
      id uuid CONSTRAINT grants_pkey PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL CONSTRAINT grants_user_id_fkey REFERENCES users ON DELETE CASCADE,
      ai_client_id text NOT NULL,
      ai_client_name text NOT NULL,
      redirect_uri text NOT NULL,
      resource text NOT NULL,
      permissions text[] NOT NULL,
      expires_at timestamptz NOT NULL,
      last_used_at timestamptz,
      CONSTRAINT grants_user_id_ai_client_id_key UNIQUE (user_id, ai_client_id)
    )
  `;
  yield* sql`
    CREATE TABLE grant_access_tokens (
      token_hash text CONSTRAINT grant_access_tokens_pkey PRIMARY KEY,
      grant_id uuid NOT NULL
        CONSTRAINT grant_access_tokens_grant_id_fkey REFERENCES grants ON DELETE CASCADE,
      resource text NOT NULL,
      permissions text[] NOT NULL,
      expires_at timestamptz NOT NULL
    )
  `;
  yield* sql`CREATE INDEX grant_access_tokens_grant_id_idx ON grant_access_tokens (grant_id)`;
  yield* sql`
    CREATE TABLE grant_refresh_tokens (
      token_hash text CONSTRAINT grant_refresh_tokens_pkey PRIMARY KEY,
      grant_id uuid NOT NULL
        CONSTRAINT grant_refresh_tokens_grant_id_fkey REFERENCES grants ON DELETE CASCADE,
      resource text NOT NULL,
      permissions text[] NOT NULL,
      replaced boolean NOT NULL
    )
  `;
  yield* sql`CREATE INDEX grant_refresh_tokens_grant_id_idx ON grant_refresh_tokens (grant_id)`;
});

// An AI Client whose Grant goes asks its User to approve again: nothing is lost that the User cannot give back.
export const down = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`DROP TABLE grant_refresh_tokens`;
  yield* sql`DROP TABLE grant_access_tokens`;
  yield* sql`DROP TABLE grants`;
});
