import { assert, it } from "@effect/vitest";
import { Api } from "@quack/contracts/api";
import { Authentication } from "@quack/contracts/identity/authentication";
import { Forbidden, Unauthenticated } from "@quack/contracts/identity/identity-errors";
import { CountryCode, Profile, type Team } from "@quack/contracts/identity/profile";
import {
  Email,
  type Role,
  TimeZone,
  User,
  UserId,
  type UserStatus,
} from "@quack/contracts/identity/user";
import {
  CannotChangeOwnAccess,
  CannotDeleteSelf,
  UserInvited,
  UserNotFound,
} from "@quack/contracts/users/user-errors";
import { TodoId, TodoTitle } from "@quack/contracts/todos/todo";
import { OnboardingPayload, type UserOrder } from "@quack/contracts/users/users-api";
import { ConfigProvider, DateTime, Effect, Layer, Redacted, Schema } from "effect";
import { HttpServer } from "effect/http";
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api";
import { TestClock } from "effect/testing";

import { IdentityModule, IdentityPostgres } from "#/modules/identity/index.ts";
import { MailerMemory } from "#/modules/mail/index.ts";
import {
  aUser,
  knownPassword,
  passwordHashOf,
  signedIn,
  TestDatabase,
} from "#/modules/testing/index.ts";
import { TodosModule } from "#/modules/todos/index.ts";
import { TransactionPostgres } from "#/modules/transaction/index.ts";
import { Users, UsersModule } from "#/modules/users/index.ts";

// The todos endpoints too: a Role gives Permissions on both.
const UsersApi = Layer.mergeAll(UsersModule, TodosModule).pipe(
  Layer.provideMerge(IdentityModule),
  Layer.provideMerge([Users.layer, IdentityPostgres, TransactionPostgres]),
  Layer.provide(MailerMemory),
  Layer.provideMerge(HttpServer.layerServices),
  Layer.provideMerge(TestDatabase),
  Layer.provide(
    ConfigProvider.layer(ConfigProvider.fromUnknown({ PUBLIC_URL: "https://quack.test" })),
  ),
);

/** Day `n` of January 2026, at midnight UTC. */
const day = (n: number) => DateTime.makeUnsafe(`2026-01-${String(n).padStart(2, "0")}T00:00:00Z`);

const dayOrNull = (n: number | null) => (n === null ? null : day(n));

const zone = Schema.decodeSync(TimeZone);

const paris = zone("Europe/Paris");

const userOf = (
  name: string,
  {
    role = "user",
    status = "active",
    createdOn,
    lastSignInOn,
    onboardedOn = null,
    profile,
  }: {
    role?: Role;
    status?: UserStatus;
    createdOn: number;
    lastSignInOn: number | null;
    onboardedOn?: number | null;
    profile: { lastName: string; team: Team; country: string } | null;
  },
) => ({
  email: Email.make(`${name}@example.com`),
  role,
  status,
  createdAt: day(createdOn),
  lastSignInAt: dayOrNull(lastSignInOn),
  onboardedAt: dayOrNull(onboardedOn),
  profile:
    profile === null
      ? null
      : new Profile({
          firstName: name[0]?.toUpperCase() + name.slice(1),
          lastName: profile.lastName,
          avatarUrl: null,
          jobTitle: "",
          team: profile.team,
          country: CountryCode.make(profile.country),
        }),
});

// Grace signs in after every date of the others: her last sign-in stays the latest.
const signInDay = day(20);

/** Five Users of every Status, and a client of Grace, their Admin, who signs in on `signInDay`. */
const fiveUsers = Effect.gen(function* () {
  yield* TestClock.setTime(DateTime.toEpochMillis(signInDay));

  const grace = yield* aUser(
    userOf("grace", {
      role: "admin",
      createdOn: 1,
      lastSignInOn: 10,
      onboardedOn: 1,
      profile: { lastName: "Hopper", team: "engineering", country: "US" },
    }),
  );

  const ada = yield* aUser(
    userOf("ada", {
      createdOn: 2,
      lastSignInOn: 9,
      onboardedOn: 3,
      profile: { lastName: "Lovelace", team: "product", country: "GB" },
    }),
  );

  const linus = yield* aUser(
    userOf("linus", {
      status: "suspended",
      createdOn: 3,
      lastSignInOn: 5,
      profile: { lastName: "Torvalds", team: "engineering", country: "FI" },
    }),
  );

  const edsger = yield* aUser(
    userOf("edsger", { status: "invited", createdOn: 5, lastSignInOn: null, profile: null }),
  );

  const barbara = yield* aUser(
    userOf("barbara", {
      createdOn: 4,
      lastSignInOn: 8,
      profile: { lastName: "Liskov", team: "design", country: "US" },
    }),
  );

  const client = yield* signedIn(grace, ["users"]);

  return { grace, ada, linus, edsger, barbara, client };
});

const emailsOf = (...list: ReadonlyArray<User>) => list.map(({ email }) => email);

const emailsSortedOf = (...list: ReadonlyArray<User>) => emailsOf(...list).toSorted();

const firstPage = { page: 1, pageSize: 20, orderBy: "email", dir: "asc" } as const;

const anAdmin = Effect.flatMap(aUser({ role: "admin" }), (admin) =>
  Effect.map(signedIn(admin, ["users"]), (client) => ({ admin, client })),
);

const aSignedInUser = Effect.flatMap(aUser(), (user) =>
  Effect.map(signedIn(user, ["users", "identity"]), (client) => ({ user, client })),
);

type SignedInClient = Effect.Success<typeof aSignedInUser>["client"];

/** The Current User, as the other endpoints answer it. */
const currentUserOf = (client: SignedInClient) =>
  Effect.map(client.identity.me(), ({ pendingEmail: _, ...user }) => new User(user));

const visitor = HttpApiTest.groups(Api, ["users"]).pipe(
  Effect.provide(
    HttpApiMiddleware.layerClient(Authentication, ({ next, request }) => next(request)),
  ),
);

it.effect("lists every User for an admin, sorted by email, with their total", () =>
  Effect.gen(function* () {
    const { client, ...users } = yield* fiveUsers;

    const page = yield* client.users.list({ query: firstPage });

    assert.strictEqual(page.total, 5);
    assert.deepStrictEqual(
      page.items.map(({ email }) => email),
      emailsSortedOf(...Object.values(users)),
    );
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("pages the Users: the last page is partial, a page beyond it is empty", () =>
  Effect.gen(function* () {
    const { client, ...users } = yield* fiveUsers;
    const sorted = emailsSortedOf(...Object.values(users));

    const pageOf = (page: number) =>
      client.users
        .list({ query: { ...firstPage, page, pageSize: 2 } })
        .pipe(
          Effect.map(({ items, total }) => ({ emails: items.map(({ email }) => email), total })),
        );

    assert.deepStrictEqual(yield* pageOf(1), { emails: sorted.slice(0, 2), total: 5 });
    assert.deepStrictEqual(yield* pageOf(2), { emails: sorted.slice(2, 4), total: 5 });
    assert.deepStrictEqual(yield* pageOf(3), { emails: sorted.slice(4), total: 5 });
    assert.deepStrictEqual(yield* pageOf(4), { emails: [], total: 5 });
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("sorts by the field and in the direction asked, ties by email, ascending", () =>
  Effect.gen(function* () {
    const { client, grace, ...others } = yield* fiveUsers;
    const sorted = emailsSortedOf(grace, ...Object.values(others));
    const userEmails = emailsSortedOf(...Object.values(others));

    const emailsBy = (orderBy: "email" | "role", dir: "asc" | "desc") =>
      client.users
        .list({ query: { ...firstPage, orderBy, dir } })
        .pipe(Effect.map(({ items }) => items.map(({ email }) => email)));

    assert.deepStrictEqual(yield* emailsBy("email", "desc"), sorted.toReversed());
    assert.deepStrictEqual(yield* emailsBy("role", "asc"), [grace.email, ...userEmails]);
    assert.deepStrictEqual(yield* emailsBy("role", "desc"), [...userEmails, grace.email]);
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("keeps the Users whose email or full name contains the search, whatever its case", () =>
  Effect.gen(function* () {
    const { client, ada, barbara, edsger, linus } = yield* fiveUsers;

    const search = (text: string, page = 1) =>
      client.users
        .list({ query: { ...firstPage, page, pageSize: 1, search: text } })
        .pipe(
          Effect.map(({ items, total }) => ({ emails: items.map(({ email }) => email), total })),
        );

    assert.deepStrictEqual(yield* search(" R"), { emails: [barbara.email], total: 4 });
    assert.deepStrictEqual(yield* search(" R", 2), { emails: [edsger.email], total: 4 });
    assert.deepStrictEqual(yield* search("LINUS@"), { emails: [linus.email], total: 1 });
    assert.deepStrictEqual(yield* search("Ada Love"), { emails: [ada.email], total: 1 });
    assert.deepStrictEqual(yield* search("torvalds"), { emails: [linus.email], total: 1 });
    assert.deepStrictEqual(yield* search("nobody"), { emails: [], total: 0 });
    assert.deepStrictEqual(yield* search(""), { emails: [ada.email], total: 5 });
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("keeps the Users of the Role asked, along with the search", () =>
  Effect.gen(function* () {
    const { client, grace, ada, edsger, linus } = yield* fiveUsers;

    const filter = (query: { role: Role; search?: string }) =>
      client.users
        .list({ query: { ...firstPage, ...query } })
        .pipe(
          Effect.map(({ items, total }) => ({ emails: items.map(({ email }) => email), total })),
        );

    assert.deepStrictEqual(yield* filter({ role: "admin" }), { emails: [grace.email], total: 1 });
    assert.deepStrictEqual(yield* filter({ role: "user", search: "d" }), {
      emails: emailsOf(ada, edsger, linus),
      total: 3,
    });
    assert.deepStrictEqual(yield* filter({ role: "admin", search: "ada" }), {
      emails: [],
      total: 0,
    });
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("sorts by status, then by email", () =>
  Effect.gen(function* () {
    const { client, grace, ada, edsger, linus, barbara } = yield* fiveUsers;

    const page = yield* client.users.list({
      query: { ...firstPage, orderBy: "status", dir: "desc" },
    });

    assert.deepStrictEqual(
      page.items.map(({ email }) => email),
      emailsOf(linus, edsger, ada, barbara, grace),
    );
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("sorts by a date, and puts the Users who have none last in either direction", () =>
  Effect.gen(function* () {
    const { client, grace, ada, edsger, linus, barbara } = yield* fiveUsers;

    const emailsBy = (orderBy: "createdAt" | "lastSignInAt", dir: "asc" | "desc") =>
      client.users
        .list({ query: { ...firstPage, orderBy, dir } })
        .pipe(Effect.map(({ items }) => items.map(({ email }) => email)));

    assert.deepStrictEqual(
      yield* emailsBy("lastSignInAt", "desc"),
      emailsOf(grace, ada, barbara, linus, edsger),
    );
    assert.deepStrictEqual(
      yield* emailsBy("lastSignInAt", "asc"),
      emailsOf(linus, barbara, ada, grace, edsger),
    );
    assert.deepStrictEqual(
      yield* emailsBy("createdAt", "asc"),
      emailsOf(grace, ada, linus, barbara, edsger),
    );
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("keeps the Users of the status asked", () =>
  Effect.gen(function* () {
    const { client, grace, ada, linus, barbara } = yield* fiveUsers;

    const emailsWith = (status: UserStatus) =>
      client.users
        .list({ query: { ...firstPage, status } })
        .pipe(Effect.map(({ items }) => items.map(({ email }) => email)));

    assert.deepStrictEqual(yield* emailsWith("suspended"), [linus.email]);
    assert.deepStrictEqual(yield* emailsWith("active"), emailsOf(ada, barbara, grace));
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("sorts by name, last name first, and by country, those with no Profile last", () =>
  Effect.gen(function* () {
    const { client, grace, ada, edsger, linus, barbara } = yield* fiveUsers;

    const emailsBy = (orderBy: UserOrder, dir: "asc" | "desc") =>
      client.users
        .list({ query: { ...firstPage, orderBy, dir } })
        .pipe(Effect.map(({ items }) => items.map(({ email }) => email)));

    assert.deepStrictEqual(
      yield* emailsBy("name", "asc"),
      emailsOf(grace, barbara, ada, linus, edsger),
    );
    assert.deepStrictEqual(
      yield* emailsBy("name", "desc"),
      emailsOf(linus, ada, barbara, grace, edsger),
    );
    assert.deepStrictEqual(
      yield* emailsBy("country", "desc"),
      emailsOf(barbara, grace, ada, linus, edsger),
    );
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("keeps the Users of the team asked, along with the status", () =>
  Effect.gen(function* () {
    const { client, grace, linus } = yield* fiveUsers;

    const emailsWhere = (filters: { status?: UserStatus; team: Team }) =>
      client.users
        .list({ query: { ...firstPage, ...filters } })
        .pipe(Effect.map(({ items }) => items.map(({ email }) => email)));

    assert.deepStrictEqual(yield* emailsWhere({ team: "engineering" }), emailsOf(grace, linus));
    assert.deepStrictEqual(yield* emailsWhere({ status: "active", team: "engineering" }), [
      grace.email,
    ]);
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("keeps the Users onboarded, or those not yet", () =>
  Effect.gen(function* () {
    const { client, grace, ada, edsger, linus, barbara } = yield* fiveUsers;

    const emailsWhere = (onboarded: boolean) =>
      client.users
        .list({ query: { ...firstPage, onboarded } })
        .pipe(Effect.map(({ items }) => items.map(({ email }) => email)));

    assert.deepStrictEqual(yield* emailsWhere(true), emailsOf(ada, grace));
    assert.deepStrictEqual(yield* emailsWhere(false), emailsOf(barbara, edsger, linus));
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("gives an admin a User by their id, with their Profile", () =>
  Effect.gen(function* () {
    const { client, ada } = yield* fiveUsers;

    assert.deepStrictEqual(yield* client.users.get({ params: { id: ada.id } }), ada);
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("answers UserNotFound, 404, for an id no User has", () =>
  Effect.gen(function* () {
    const { client } = yield* anAdmin;
    const id = UserId.make(crypto.randomUUID());

    const error = yield* client.users.get({ params: { id } }).pipe(Effect.flip);
    const response = yield* client.users.get({ params: { id }, responseMode: "response-only" });

    assert.deepStrictEqual(error, new UserNotFound({ id }));
    assert.strictEqual(response.status, 404);
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("answers UserNotFound for an id that is no uuid", () =>
  Effect.gen(function* () {
    const { client } = yield* anAdmin;
    const id = UserId.make("not-a-uuid");

    const error = yield* client.users.get({ params: { id } }).pipe(Effect.flip);

    assert.deepStrictEqual(error, new UserNotFound({ id }));
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("refuses a user every Users endpoint with Forbidden, 403, and its Permission", () =>
  Effect.gen(function* () {
    const { client } = yield* aSignedInUser;
    const target = yield* aUser();
    const params = { id: target.id };

    const errors = [
      yield* client.users.list({ query: firstPage }).pipe(Effect.flip),
      yield* client.users.get({ params }).pipe(Effect.flip),
      yield* client.users.update({ params, payload: { status: "suspended" } }).pipe(Effect.flip),
      yield* client.users.remove({ params }).pipe(Effect.flip),
    ];

    const response = yield* client.users.get({ params, responseMode: "response-only" });

    assert.deepStrictEqual(errors, [
      new Forbidden({ permission: "users:list" }),
      new Forbidden({ permission: "users:read" }),
      new Forbidden({ permission: "users:write" }),
      new Forbidden({ permission: "users:delete" }),
    ]);
    assert.strictEqual(response.status, 403);
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("refuses a visitor with Unauthenticated, 401", () =>
  Effect.gen(function* () {
    const client = yield* visitor;

    const error = yield* client.users.list({ query: firstPage }).pipe(Effect.flip);

    const response = yield* client.users.list({
      query: firstPage,
      responseMode: "response-only",
    });

    assert.deepStrictEqual(error, new Unauthenticated());
    assert.strictEqual(response.status, 401);
  }).pipe(Effect.provide(UsersApi)),
);

it.effect.each([
  ["active", "suspended"],
  ["suspended", "active"],
  ["active", "active"],
  ["suspended", "suspended"],
] as const)("moves a User from %s to %s", ([from, to]) =>
  Effect.gen(function* () {
    const { client } = yield* anAdmin;
    const target = yield* aUser({ status: from });
    const params = { id: target.id };

    const updated = yield* client.users.update({ params, payload: { status: to } });

    assert.deepStrictEqual(updated, new User({ ...target, status: to }));
    assert.deepStrictEqual(yield* client.users.get({ params }), updated);
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("changes the Role of a User, and nothing else", () =>
  Effect.gen(function* () {
    const { client } = yield* anAdmin;
    const target = yield* aUser();

    const user = yield* client.users.update({
      params: { id: target.id },
      payload: { role: "admin" },
    });

    assert.deepStrictEqual(user, new User({ ...target, role: "admin" }));
  }).pipe(Effect.provide(UsersApi)),
);

it.effect.each(["active", "suspended"] as const)(
  "refuses to set %s on an invited User, 409, and changes nothing",
  (status) =>
    Effect.gen(function* () {
      const { client } = yield* anAdmin;
      const target = yield* aUser({ status: "invited" });
      const params = { id: target.id };

      const error = yield* client.users
        .update({ params, payload: { role: "admin", status } })
        .pipe(Effect.flip);

      const response = yield* client.users.update({
        params,
        payload: { status },
        responseMode: "response-only",
      });

      assert.deepStrictEqual(error, new UserInvited({ id: target.id }));
      assert.strictEqual(response.status, 409);
      assert.deepStrictEqual(yield* client.users.get({ params }), target);
    }).pipe(Effect.provide(UsersApi)),
);

it.effect("changes the Role of an invited User", () =>
  Effect.gen(function* () {
    const { client } = yield* anAdmin;
    const target = yield* aUser({ status: "invited" });

    const user = yield* client.users.update({
      params: { id: target.id },
      payload: { role: "admin" },
    });

    assert.strictEqual(user.role, "admin");
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("refuses an admin a change of their own access, 403", () =>
  Effect.gen(function* () {
    const { admin, client } = yield* anAdmin;
    const params = { id: admin.id };

    const error = yield* client.users
      .update({ params, payload: { status: "suspended" } })
      .pipe(Effect.flip);

    const response = yield* client.users.update({
      params,
      payload: { role: "user" },
      responseMode: "response-only",
    });

    const stored = yield* client.users.get({ params });

    assert.deepStrictEqual(error, new CannotChangeOwnAccess());
    assert.strictEqual(response.status, 403);
    assert.deepStrictEqual([stored.role, stored.status], ["admin", "active"]);
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("answers UserNotFound, 404, for a change to an id no User has", () =>
  Effect.gen(function* () {
    const { client } = yield* anAdmin;
    const id = UserId.make(crypto.randomUUID());

    const error = yield* client.users
      .update({ params: { id }, payload: { role: "admin" } })
      .pipe(Effect.flip);

    assert.deepStrictEqual(error, new UserNotFound({ id }));
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("deletes a User, who is then found no more", () =>
  Effect.gen(function* () {
    const { client } = yield* anAdmin;
    const target = yield* aUser();
    const params = { id: target.id };

    const response = yield* client.users.remove({ params, responseMode: "response-only" });
    const error = yield* client.users.get({ params }).pipe(Effect.flip);

    assert.strictEqual(response.status, 204);
    assert.deepStrictEqual(error, new UserNotFound({ id: target.id }));
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("refuses an admin to delete themself, 403, and deletes nothing", () =>
  Effect.gen(function* () {
    const { admin, client } = yield* anAdmin;
    const params = { id: admin.id };

    const error = yield* client.users.remove({ params }).pipe(Effect.flip);
    const response = yield* client.users.remove({ params, responseMode: "response-only" });

    assert.deepStrictEqual(error, new CannotDeleteSelf());
    assert.strictEqual(response.status, 403);
    assert.strictEqual((yield* client.users.get({ params })).id, admin.id);
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("answers UserNotFound, 404, to delete an id no User has", () =>
  Effect.gen(function* () {
    const { client } = yield* anAdmin;
    const id = UserId.make(crypto.randomUUID());

    const error = yield* client.users.remove({ params: { id } }).pipe(Effect.flip);

    assert.deepStrictEqual(error, new UserNotFound({ id }));
  }).pipe(Effect.provide(UsersApi)),
);

const aProfile = (firstName: string) =>
  new Profile({
    firstName,
    lastName: "Lovelace",
    avatarUrl: null,
    jobTitle: "Analyst",
    team: "engineering",
    country: CountryCode.make("GB"),
  });

const nameOfAda = Schema.decodeSync(OnboardingPayload)({
  firstName: " Ada ",
  lastName: "Lovelace",
});

it.effect("updates the Profile of the Current User: me answers with it from then on", () =>
  Effect.gen(function* () {
    const { client } = yield* aSignedInUser;
    const before = yield* currentUserOf(client);

    const updated = yield* client.users.updateProfile({ payload: aProfile("Ada") });

    assert.deepStrictEqual(updated, new User({ ...before, profile: aProfile("Ada") }));
    assert.deepStrictEqual((yield* client.identity.me()).profile, aProfile("Ada"));
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("replaces the whole Profile at each update", () =>
  Effect.gen(function* () {
    const { client } = yield* aSignedInUser;
    const augusta = new Profile({ ...aProfile("Augusta"), team: null, country: null });
    yield* client.users.updateProfile({ payload: aProfile("Ada") });

    yield* client.users.updateProfile({ payload: augusta });

    assert.deepStrictEqual((yield* client.identity.me()).profile, augusta);
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("updates the Profile and the time zone of the Current User only", () =>
  Effect.gen(function* () {
    const { client: ada } = yield* aSignedInUser;
    const { client: charles } = yield* aSignedInUser;

    yield* ada.users.updateProfile({ payload: aProfile("Ada") });
    yield* ada.users.updateTimeZone({
      payload: { timeZone: zone("Asia/Tokyo") },
    });

    const other = yield* charles.identity.me();
    assert.isNull(other.profile);
    assert.strictEqual(DateTime.zoneToString(other.timeZone), "Europe/Paris");
  }).pipe(Effect.provide(UsersApi)),
);

it.effect("changes the time zone of the Current User: me answers with it from then on", () =>
  Effect.gen(function* () {
    const { client } = yield* aSignedInUser;
    const newYork = zone("America/New_York");

    const updated = yield* client.users.updateTimeZone({ payload: { timeZone: newYork } });

    assert.strictEqual(DateTime.zoneToString(updated.timeZone), "America/New_York");
    assert.deepStrictEqual(
      DateTime.zoneToString((yield* client.identity.me()).timeZone),
      "America/New_York",
    );
  }).pipe(Effect.provide(UsersApi)),
);

it.effect(
  "completes the onboarding: the name makes the Profile, nothing else filled in, and the date is set",
  () =>
    Effect.gen(function* () {
      const { client } = yield* aSignedInUser;
      const before = yield* currentUserOf(client);
      const now = yield* DateTime.now;

      const onboarded = yield* client.users.completeOnboarding({ payload: nameOfAda });

      assert.deepStrictEqual(
        onboarded,
        new User({
          ...before,
          onboardedAt: now,
          timeZone: paris,
          profile: new Profile({
            firstName: "Ada",
            lastName: "Lovelace",
            jobTitle: "",
            team: null,
            country: null,
            avatarUrl: null,
          }),
        }),
      );
      assert.deepStrictEqual((yield* client.identity.me()).profile, onboarded.profile);
    }).pipe(Effect.provide(UsersApi)),
);

it.effect(
  "completes the onboarding again: changes the name, keeps the rest and the first date",
  () =>
    Effect.gen(function* () {
      const { client } = yield* aSignedInUser;
      yield* client.users.updateProfile({ payload: aProfile("Ada") });
      const first = yield* client.users.completeOnboarding({ payload: nameOfAda });
      yield* TestClock.adjust("1 hour");

      const again = yield* client.users.completeOnboarding({
        payload: { ...nameOfAda, lastName: "Byron" },
      });

      assert.deepStrictEqual(again.profile, new Profile({ ...aProfile("Ada"), lastName: "Byron" }));
      assert.deepStrictEqual(again.onboardedAt, first.onboardedAt);
    }).pipe(Effect.provide(UsersApi)),
);

it.effect("refuses the Current User's endpoints to a visitor with Unauthenticated, 401", () =>
  Effect.gen(function* () {
    const client = yield* visitor;

    const errors = [
      yield* client.users.updateProfile({ payload: aProfile("Ada") }).pipe(Effect.flip),
      yield* client.users.updateTimeZone({ payload: { timeZone: paris } }).pipe(Effect.flip),
      yield* client.users.completeOnboarding({ payload: nameOfAda }).pipe(Effect.flip),
    ];

    const response = yield* client.users.updateTimeZone({
      payload: { timeZone: paris },
      responseMode: "response-only",
    });

    assert.deepStrictEqual(errors, [
      new Unauthenticated(),
      new Unauthenticated(),
      new Unauthenticated(),
    ]);
    assert.strictEqual(response.status, 401);
  }).pipe(Effect.provide(UsersApi)),
);

/** The Permission an endpoint refused the caller, or `allowed` when it let them past, whatever it answered then. */
const permissionRefused = <A, E>(call: Effect.Effect<A, E>) =>
  Effect.match(call, {
    onFailure: (error) => (error instanceof Forbidden ? error.permission : "allowed"),
    onSuccess: () => "allowed",
  });

it.effect.each([
  [
    "user",
    ["allowed", "allowed", "allowed", "users:list", "users:read", "users:write", "users:delete"],
  ],
  ["admin", ["allowed", "allowed", "allowed", "allowed", "allowed", "allowed", "allowed"]],
] as const)(
  "gives a %s the Permissions of their Role, and refuses the others",
  ([role, expected]) =>
    Effect.gen(function* () {
      const client = yield* signedIn(yield* aUser({ role }), ["todos", "users"]);
      const params = { id: (yield* aUser()).id };

      const outcomes = [
        yield* permissionRefused(client.todos.list()),
        yield* permissionRefused(
          client.todos.create({ payload: { title: TodoTitle.make("Ship") } }),
        ),
        yield* permissionRefused(
          client.todos.remove({ params: { id: TodoId.make(crypto.randomUUID()) } }),
        ),
        yield* permissionRefused(client.users.list({ query: firstPage })),
        yield* permissionRefused(client.users.get({ params })),
        yield* permissionRefused(client.users.update({ params, payload: { role: "user" } })),
        yield* permissionRefused(client.users.remove({ params })),
      ];

      assert.deepStrictEqual(outcomes, [...expected]);
    }).pipe(Effect.provide(UsersApi)),
);

const identityVisitor = HttpApiTest.groups(Api, ["identity"]).pipe(
  Effect.provide(
    HttpApiMiddleware.layerClient(Authentication, ({ next, request }) => next(request)),
  ),
);

/** The User the credentials sign in, or the tag of the error that refused them. */
const signInWith = (email: Email, password: typeof knownPassword) =>
  Effect.flatMap(identityVisitor, (client) =>
    client.identity.signIn({ payload: { email, password } }).pipe(
      Effect.map(({ id }) => id),
      Effect.catchTag("InvalidCredentials", (error) => Effect.succeed(error._tag)),
    ),
  );

// Computed apart from this module, with `argon2Sync` of node:crypto, the password `knownPassword` and the salt
// 00 01 02 ... 0f.
const hashOfAnotherImplementation =
  "$argon2id$v=19$m=19456,t=2,p=1$AAECAwQFBgcICQoLDA0ODw$gYJZtjEAJqjg26xdLmknq8/bB7MiWPrE9hsYuA+SkIU";

// The same password and salt, hashed with other costs.
const hashOfOtherCosts =
  "$argon2id$v=19$m=8192,t=3,p=1$AAECAwQFBgcICQoLDA0ODw$lHMS9i5KyG9jybYi8UewBhhGc59T3QDy0iNs0D20E6w";

it.effect(
  "stores a password as argon2id at m=19456, t=2, p=1, salted for each User, with a 16 byte salt and a 32 byte tag",
  () =>
    Effect.gen(function* () {
      const client = yield* identityVisitor;
      const emails = [Email.make("ada.hash@example.com"), Email.make("grace.hash@example.com")];

      for (const email of emails) {
        yield* client.identity.signUp({
          payload: { email, password: knownPassword, timeZone: paris },
        });
      }

      const hashes = [yield* passwordHashOf(emails[0]!), yield* passwordHashOf(emails[1]!)];

      // Base64 without padding: 16 bytes are 22 characters, 32 bytes are 43.
      for (const hash of hashes) {
        assert.match(
          hash,
          /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/,
        );
      }

      assert.notStrictEqual(hashes[0], hashes[1]);
    }).pipe(Effect.provide(UsersApi)),
);

it.effect.each([
  ["made by another argon2id implementation", hashOfAnotherImplementation],
  ["of costs other than the current ones", hashOfOtherCosts],
] as const)("signs a User in with a stored hash %s, and refuses another password", ([, hash]) =>
  Effect.gen(function* () {
    const user = yield* aUser({}, hash);

    assert.strictEqual(yield* signInWith(user.email, knownPassword), user.id);
    assert.strictEqual(
      yield* signInWith(user.email, Redacted.make("another password")),
      "InvalidCredentials",
    );
  }).pipe(Effect.provide(UsersApi)),
);

it.effect.each([
  "",
  "not a hash",
  "$2b$10$abcdefghijklmnopqrstuv",
  hashOfAnotherImplementation.slice(0, -1),
])(
  "refuses the sign-in of a User whose stored hash %j cannot be read, as a wrong password",
  (hash) =>
    Effect.gen(function* () {
      const user = yield* aUser({}, hash);

      assert.strictEqual(yield* signInWith(user.email, knownPassword), "InvalidCredentials");
    }).pipe(Effect.provide(UsersApi)),
);
