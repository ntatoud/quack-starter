import { EmailAlreadyTaken } from "@quack/contracts/identity/identity-errors";
import { Email, User, UserId } from "@quack/contracts/identity/user";
import { type UserOrder, UserListQuery } from "@quack/contracts/users/users-api";
import { Effect, Layer, Option, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import type { Fragment } from "effect/sql/Statement";

import { UserRepository } from "#/modules/identity/domain/user-repository.ts";

const UserWithHash = Schema.Struct({ user: User, passwordHash: Schema.String });

const UserList = Schema.Struct({ items: Schema.Array(User), total: Schema.Int });

const escapeLike = (text: string) => text.replaceAll(/[\\%_]/g, "\\$&");

export const UserRepositoryPostgres = Layer.effect(
  UserRepository,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    // Built as the encoded User, so the contract's schema decodes it, Profile and dates included.
    const userJson = sql`jsonb_build_object(
      'id', id,
      'email', email,
      'role', role,
      'status', status,
      'created_at', created_at,
      'last_sign_in_at', last_sign_in_at,
      'email_verified_at', email_verified_at,
      'profile', CASE WHEN user_id IS NULL THEN NULL ELSE jsonb_build_object(
        'first_name', first_name,
        'last_name', last_name,
        'avatar_url', avatar_url,
        'job_title', job_title,
        'team', team,
        'country', country
      ) END
    )`;

    const usersWithProfiles = sql`users LEFT JOIN user_profiles ON user_profiles.user_id = users.id`;

    const sortKeys: Record<UserOrder, ReadonlyArray<Fragment>> = {
      email: [sql`email`],
      name: [sql`lower(last_name)`, sql`lower(first_name)`],
      role: [sql`role`],
      status: [sql`status`],
      team: [sql`team`],
      country: [sql`country`],
      createdAt: [sql`created_at`],
      lastSignInAt: [sql`last_sign_in_at`],
    };

    const selectUser = (condition: Fragment) =>
      sql`SELECT ${userJson} AS user, password_hash FROM ${usersWithProfiles} WHERE ${condition}`;

    const findById = SqlSchema.findOneOption({
      Request: UserId,
      Result: UserWithHash,
      execute: (id) => selectUser(sql`id = ${id}`),
    });

    const findByEmail = SqlSchema.findOneOption({
      Request: Email,
      Result: UserWithHash,
      execute: (email) => selectUser(sql`email = ${email}`),
    });

    // The total comes from every matching row, so a page past the last one still has it.
    const list = SqlSchema.findOne({
      Request: Schema.toType(UserListQuery),
      Result: UserList,
      execute: ({ page, pageSize, orderBy, dir, search = "", status, role, team }) => {
        const pattern = `%${escapeLike(search)}%`;
        const filters = [
          ...(search === ""
            ? []
            : [sql`(email ILIKE ${pattern} OR (first_name || ' ' || last_name) ILIKE ${pattern})`]),
          ...(status === undefined ? [] : [sql`status = ${status}`]),
          ...(role === undefined ? [] : [sql`role = ${role}`]),
          ...(team === undefined ? [] : [sql`team = ${team}`]),
        ];
        const direction = dir === "asc" ? sql`ASC` : sql`DESC`;
        const order = sql.csv([
          ...sortKeys[orderBy].map((key) => sql`${key} ${direction} NULLS LAST`),
          sql`email ASC`,
        ]);
        return sql`WITH matching AS (
              SELECT * FROM ${usersWithProfiles} WHERE ${sql.and(filters)}
            ),
            page AS (
              SELECT * FROM matching ORDER BY ${order}
              LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
            )
            SELECT
              (SELECT count(*)::int FROM matching) AS total,
              coalesce(jsonb_agg(${userJson} ORDER BY ${order}), '[]') AS items
            FROM page`;
      },
    });

    const profileWrite = (user: typeof User.Encoded) =>
      user.profile === null
        ? sql`DELETE FROM user_profiles WHERE user_id IN (SELECT id FROM written)`
        : sql`INSERT INTO user_profiles
                (user_id, first_name, last_name, avatar_url, job_title, team, country)
              SELECT id, ${user.profile.firstName}, ${user.profile.lastName}, ${user.profile.avatarUrl},
                ${user.profile.jobTitle}, ${user.profile.team}, ${user.profile.country}
              FROM written
              ON CONFLICT (user_id) DO UPDATE SET
                first_name = excluded.first_name,
                last_name = excluded.last_name,
                avatar_url = excluded.avatar_url,
                job_title = excluded.job_title,
                team = excluded.team,
                country = excluded.country`;

    const insert = SqlSchema.void({
      Request: UserWithHash,
      execute: ({ user, passwordHash }) =>
        sql`WITH written AS (
              INSERT INTO users
                (id, email, password_hash, role, status, created_at, last_sign_in_at, email_verified_at)
              VALUES (${user.id}, ${user.email}, ${passwordHash}, ${user.role}, ${user.status},
                ${user.createdAt}, ${user.lastSignInAt}, ${user.emailVerifiedAt})
              RETURNING id
            )
            ${profileWrite(user)}`,
    });

    const update = SqlSchema.void({
      Request: User,
      execute: (user) =>
        sql`WITH written AS (
              UPDATE users SET
                role = ${user.role},
                status = ${user.status},
                created_at = ${user.createdAt},
                last_sign_in_at = ${user.lastSignInAt},
                email_verified_at = ${user.emailVerifiedAt}
              WHERE id = ${user.id}
              RETURNING id
            )
            ${profileWrite(user)}`,
    });

    return UserRepository.of({
      nextId: Effect.sync(() => UserId.make(crypto.randomUUID())),
      create: Effect.fn("UserRepository.create")(function* (user, passwordHash) {
        yield* insert({ user, passwordHash }).pipe(
          Effect.catchTags({
            SqlError: (error) =>
              error.reason._tag === "UniqueViolation" &&
              error.reason.constraint === "users_email_key"
                ? Effect.fail(new EmailAlreadyTaken())
                : Effect.die(error),
            SchemaError: Effect.die,
          }),
        );
      }),
      update: Effect.fn("UserRepository.update")((user) => update(user).pipe(Effect.orDie)),
      findById: Effect.fn("UserRepository.findById")((id) =>
        findById(id).pipe(
          Effect.map((found) => found.pipe(Option.map(({ user }) => user))),
          Effect.orDie,
        ),
      ),
      findByEmail: Effect.fn("UserRepository.findByEmail")((email) =>
        findByEmail(email).pipe(Effect.orDie),
      ),
      findAll: Effect.fn("UserRepository.findAll")((query) => list(query).pipe(Effect.orDie)),
    });
  }),
);
