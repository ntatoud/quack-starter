import { UserId } from "@quack/contracts/identity/user";
import { DateTime, Effect } from "effect";
import { SqlClient } from "effect/sql";

/** A new User, stored for the rows of a test that need one: a Todo's Owner, a Session's User. */
export const aStoredUser: Effect.Effect<UserId, never, SqlClient.SqlClient> = Effect.gen(
  function* () {
    const sql = yield* SqlClient.SqlClient;
    const id = UserId.make(crypto.randomUUID());
    const createdAt = DateTime.toDate(yield* DateTime.now);

    yield* sql`
      INSERT INTO users (id, email, password_hash, role, status, created_at, time_zone)
      VALUES (${id}, ${`${id}@example.com`}, 'not a hash', 'user', 'active', ${createdAt}, 'Europe/Paris')
    `;

    return id;
  },
).pipe(Effect.orDie);
