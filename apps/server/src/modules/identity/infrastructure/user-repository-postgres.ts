import { EmailAlreadyTaken } from "@quack/contracts/identity/identity-errors";
import { Email, User, UserId } from "@quack/contracts/identity/user";
import { type UserOrder, UserListQuery } from "@quack/contracts/users/users-api";
import { Effect, Layer, Option, Schema } from "effect";
import { executor } from "@quack/effect-kysely/kysely";
import { SqlSchema } from "effect/sql";
import {
  type Expression,
  type ExpressionBuilder,
  type OrderByItemBuilder,
  type QueryCreator,
  type SqlBool,
  sql,
} from "kysely";
import { jsonBuildObject } from "kysely/helpers/postgres";

import { db, type Tables } from "#/database/db.ts";

import { UserRepository } from "#/modules/identity/domain/user-repository.ts";

const UserWithHash = Schema.Struct({ user: User, passwordHash: Schema.String });

const UserList = Schema.Struct({ items: Schema.Array(User), total: Schema.Int });

// An id that is no uuid finds no User: Postgres would refuse to compare it with the column, and fail the request.
const isStorableId = Schema.is(Schema.String.check(Schema.isUUID()));

const byStorableId = <A, E>(id: UserId, query: Effect.Effect<A, E>, none: A): Effect.Effect<A> =>
  isStorableId(id) ? Effect.orDie(query) : Effect.succeed(none);

const escapeLike = (text: string) => text.replaceAll(/[\\%_]/g, "\\$&");

type UsersWithProfiles = ExpressionBuilder<Tables, "users" | "userProfiles">;

const usersWithProfiles = db
  .selectFrom("users")
  .leftJoin("userProfiles", "userProfiles.userId", "users.id");

// Built as the encoded User, so the contract's schema decodes it, Profile and dates included.
const userJson = (eb: UsersWithProfiles) =>
  jsonBuildObject({
    id: eb.ref("users.id"),
    email: eb.ref("email"),
    role: eb.ref("role"),
    status: eb.ref("status"),
    createdAt: eb.ref("createdAt"),
    lastSignInAt: eb.ref("lastSignInAt"),
    onboardedAt: eb.ref("onboardedAt"),
    timeZone: eb.ref("timeZone"),
    profile: eb
      .case()
      .when("userProfiles.userId", "is", null)
      .then(null)
      .else(
        jsonBuildObject({
          firstName: eb.ref("firstName"),
          lastName: eb.ref("lastName"),
          avatarUrl: eb.ref("avatarUrl"),
          jobTitle: eb.ref("jobTitle"),
          team: eb.ref("team"),
          country: eb.ref("country"),
        }),
      )
      .end(),
  });

const sortKeys: Record<UserOrder, ReadonlyArray<(eb: UsersWithProfiles) => Expression<unknown>>> = {
  email: [(eb) => eb.ref("email")],
  name: [(eb) => eb.fn("lower", ["lastName"]), (eb) => eb.fn("lower", ["firstName"])],
  role: [(eb) => eb.ref("role")],
  status: [(eb) => eb.ref("status")],
  team: [(eb) => eb.ref("team")],
  country: [(eb) => eb.ref("country")],
  createdAt: [(eb) => eb.ref("createdAt")],
  lastSignInAt: [(eb) => eb.ref("lastSignInAt")],
  onboardedAt: [(eb) => eb.ref("onboardedAt")],
};

// Either way, a User with no value sorts last.
const order = (ob: OrderByItemBuilder, direction: "asc" | "desc") =>
  direction === "asc" ? ob.asc().nullsLast() : ob.desc().nullsLast();

const findUser = (where: (eb: UsersWithProfiles) => Expression<SqlBool>) =>
  usersWithProfiles.select((eb) => [userJson(eb).as("user"), "passwordHash"]).where(where);

// Writes the Profile of the User the statement wrote, whose id the `written` CTE returns.
const writeProfile = (
  written: QueryCreator<Tables & { written: { id: string } }>,
  { profile }: typeof User.Encoded,
) =>
  profile === null
    ? written
        .deleteFrom("userProfiles")
        .where("userId", "in", (eb) => eb.selectFrom("written").select("id"))
    : written
        .insertInto("userProfiles")
        .columns(["userId", "firstName", "lastName", "avatarUrl", "jobTitle", "team", "country"])
        .expression((creator) =>
          creator
            .selectFrom("written")
            .select((eb) => [
              "id",
              eb.val(profile.firstName).as("firstName"),
              eb.val(profile.lastName).as("lastName"),
              eb.val(profile.avatarUrl).as("avatarUrl"),
              eb.val(profile.jobTitle).as("jobTitle"),
              eb.val(profile.team).as("team"),
              eb.val(profile.country).as("country"),
            ]),
        )
        .onConflict((conflict) =>
          conflict.column("userId").doUpdateSet((eb) => ({
            firstName: eb.ref("excluded.firstName"),
            lastName: eb.ref("excluded.lastName"),
            avatarUrl: eb.ref("excluded.avatarUrl"),
            jobTitle: eb.ref("excluded.jobTitle"),
            team: eb.ref("excluded.team"),
            country: eb.ref("excluded.country"),
          })),
        );

export const UserRepositoryPostgres = Layer.effect(
  UserRepository,
  Effect.gen(function* () {
    const execute = yield* executor;

    const findById = SqlSchema.findOneOption({
      Request: UserId,
      Result: UserWithHash,
      execute: (id) => execute(findUser((eb) => eb("users.id", "=", id))),
    });

    const findByEmail = SqlSchema.findOneOption({
      Request: Email,
      Result: UserWithHash,
      execute: (email) => execute(findUser((eb) => eb("email", "=", email))),
    });

    // The total comes from every matching row, so a page past the last one still has it.
    const list = SqlSchema.findOne({
      Request: Schema.toType(UserListQuery),
      Result: UserList,
      execute: ({ page, pageSize, orderBy, dir, search = "", status, role, team, onboarded }) => {
        const pattern = `%${escapeLike(search)}%`;

        const matches = (eb: UsersWithProfiles) =>
          eb.and([
            ...(search === ""
              ? []
              : [
                  eb.or([
                    eb("email", "ilike", pattern),
                    eb(
                      sql<string>`${eb.ref("firstName")} || ' ' || ${eb.ref("lastName")}`,
                      "ilike",
                      pattern,
                    ),
                  ]),
                ]),
            ...(status === undefined ? [] : [eb("status", "=", status)]),
            ...(role === undefined ? [] : [eb("role", "=", role)]),
            ...(team === undefined ? [] : [eb("team", "=", team)]),
            ...(onboarded === undefined
              ? []
              : [eb("onboardedAt", onboarded ? "is not" : "is", null)]),
          ]);

        const keys = [
          ...sortKeys[orderBy].map((key) => ({ key, direction: dir })),
          { key: (eb: UsersWithProfiles) => eb.ref("email"), direction: "asc" as const },
        ];

        const pageIds = keys
          .reduce(
            (query, { key, direction }) => query.orderBy(key, (ob) => order(ob, direction)),
            usersWithProfiles.select("users.id").where(matches),
          )
          .limit(pageSize)
          .offset((page - 1) * pageSize);

        return execute(
          db.selectNoFrom(() => [
            usersWithProfiles
              .select((eb) => eb.cast<number>(eb.fn.countAll(), "integer").as("count"))
              .where(matches)
              .as("total"),
            usersWithProfiles
              .select((eb) =>
                eb.fn
                  .coalesce(
                    keys.reduce(
                      (aggregate, { key, direction }) =>
                        aggregate.orderBy(key, (ob) => order(ob, direction)),
                      eb.fn.jsonAgg(userJson(eb)),
                    ),
                    sql<[]>`'[]'`,
                  )
                  .as("items"),
              )
              .where("users.id", "in", pageIds)
              .as("items"),
          ]),
        );
      },
    });

    const insert = SqlSchema.void({
      Request: UserWithHash,
      execute: ({ user, passwordHash }) =>
        execute(
          writeProfile(
            db.with("written", (query) =>
              query
                .insertInto("users")
                .values({
                  id: user.id,
                  email: user.email,
                  passwordHash,
                  role: user.role,
                  status: user.status,
                  createdAt: user.createdAt,
                  lastSignInAt: user.lastSignInAt,
                  onboardedAt: user.onboardedAt,
                  timeZone: user.timeZone,
                })
                .returning("id"),
            ),
            user,
          ),
        ),
    });

    const update = SqlSchema.void({
      Request: User,
      execute: (user) =>
        execute(
          writeProfile(
            db.with("written", (query) =>
              query
                .updateTable("users")
                .set({
                  role: user.role,
                  status: user.status,
                  createdAt: user.createdAt,
                  lastSignInAt: user.lastSignInAt,
                  onboardedAt: user.onboardedAt,
                  timeZone: user.timeZone,
                })
                .where("id", "=", user.id)
                .returning("id"),
            ),
            user,
          ),
        ),
    });

    const setPasswordHash = SqlSchema.void({
      Request: Schema.Struct({ id: UserId, passwordHash: Schema.String }),
      execute: ({ id, passwordHash }) =>
        execute(db.updateTable("users").set({ passwordHash }).where("id", "=", id)),
    });

    // The Profile, the Todos, and the Sessions of the User go with them (`ON DELETE CASCADE`).
    const remove = SqlSchema.findAll({
      Request: UserId,
      Result: Schema.Struct({ id: UserId }),
      execute: (id) => execute(db.deleteFrom("users").where("id", "=", id).returning("id")),
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
      setPasswordHash: Effect.fn("UserRepository.setPasswordHash")((id, passwordHash) =>
        byStorableId(id, setPasswordHash({ id, passwordHash }), undefined),
      ),
      remove: Effect.fn("UserRepository.remove")((id) =>
        byStorableId(id, remove(id).pipe(Effect.map((removed) => removed.length > 0)), false),
      ),
      findById: Effect.fn("UserRepository.findById")((id) =>
        byStorableId(
          id,
          findById(id).pipe(Effect.map((found) => found.pipe(Option.map(({ user }) => user)))),
          Option.none(),
        ),
      ),
      findByEmail: Effect.fn("UserRepository.findByEmail")((email) =>
        findByEmail(email).pipe(Effect.orDie),
      ),
      findAll: Effect.fn("UserRepository.findAll")((query) => list(query).pipe(Effect.orDie)),
    });
  }),
);
