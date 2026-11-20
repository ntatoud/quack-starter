import { assert, layer } from "@effect/vitest";
import { Api } from "@quack/contracts/api";
import { Authentication, CurrentUser } from "@quack/contracts/identity/authentication";
import { Forbidden, Unauthenticated } from "@quack/contracts/identity/identity-errors";
import { CountryCode, Profile, type Team } from "@quack/contracts/identity/profile";
import { Email, type Role, User, UserId, type UserStatus } from "@quack/contracts/identity/user";
import {
  CannotChangeOwnAccess,
  UserInvited,
  UserNotFound,
} from "@quack/contracts/users/user-errors";
import type { UserOrder } from "@quack/contracts/users/users-api";
import { Effect, Layer, Redacted } from "effect";
import { HttpClientRequest, HttpServer } from "effect/http";
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api";

import { Users } from "#/modules/identity/application/users.ts";
import { UserRepository } from "#/modules/identity/domain/user-repository.ts";
import { day, dayOrNull } from "#/modules/identity/testing/days.ts";
import { RequireRoleMiddleware } from "#/modules/identity/http/require-role-middleware.ts";
import { UsersHandlers } from "#/modules/identity/http/users-handlers.ts";
import { UserRepositoryMemory } from "#/modules/identity/testing/user-repository-memory.ts";

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
) =>
  new User({
    id: UserId.make(name),
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

const grace = userOf("grace", {
  role: "admin",
  createdOn: 1,
  lastSignInOn: 10,
  onboardedOn: 1,
  profile: { lastName: "Hopper", team: "engineering", country: "US" },
});
const ada = userOf("ada", {
  createdOn: 2,
  lastSignInOn: 9,
  onboardedOn: 3,
  profile: { lastName: "Lovelace", team: "product", country: "GB" },
});
const linus = userOf("linus", {
  status: "suspended",
  createdOn: 3,
  lastSignInOn: 5,
  profile: { lastName: "Torvalds", team: "engineering", country: "FI" },
});
const edsger = userOf("edsger", {
  status: "invited",
  createdOn: 5,
  lastSignInOn: null,
  profile: null,
});
const barbara = userOf("barbara", {
  createdOn: 4,
  lastSignInOn: 8,
  profile: { lastName: "Liskov", team: "design", country: "US" },
});
const users: ReadonlyArray<User> = [grace, linus, ada, edsger, barbara];
const emailsOf = (...list: ReadonlyArray<User>) => list.map(({ email }) => email);
const firstPage = { page: 1, pageSize: 20, orderBy: "email", dir: "asc" } as const;
const emailsSorted = users.map(({ email }) => email).toSorted();

const SeededUsers = Layer.effectDiscard(
  Effect.gen(function* () {
    const repository = yield* UserRepository;
    yield* Effect.forEach(users, (user) => repository.create(user, "no password"));
  }),
);

// The session cookie is the id of the Current User: these tests need a Current User, not a Session.
const AuthenticationByUserId = Layer.succeed(
  Authentication,
  Authentication.of({
    session: (httpEffect, { credential }) => {
      const user = users.find(({ id }) => id === Redacted.value(credential));
      return user === undefined
        ? Effect.fail(new Unauthenticated())
        : Effect.provideService(httpEffect, CurrentUser, user);
    },
  }),
);

const clientOf = (user: User | undefined) =>
  HttpApiTest.groups(Api, ["users"]).pipe(
    Effect.provide(
      HttpApiMiddleware.layerClient(Authentication, ({ next, request }) =>
        next(
          user === undefined
            ? request
            : HttpClientRequest.setHeader(request, "cookie", `session=${user.id}`),
        ),
      ),
    ),
  );

const UsersLayer = UsersHandlers.pipe(
  Layer.provide(Users.layer),
  Layer.provideMerge(Layer.provideMerge(SeededUsers, UserRepositoryMemory)),
  Layer.provideMerge(RequireRoleMiddleware),
  Layer.provideMerge(AuthenticationByUserId),
);

layer(Layer.mergeAll(UsersLayer, HttpServer.layerServices))("UsersApi", (it) => {
  it.effect("lists every User for an admin, sorted by email, with their total", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(grace);

      const page = yield* client.users.list({ query: firstPage });

      assert.strictEqual(page.total, users.length);
      assert.deepStrictEqual(
        page.items.map(({ email }) => email),
        emailsSorted,
      );
    }),
  );

  it.effect("pages the Users: the last page is partial, a page beyond it is empty", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(grace);
      const pageOf = (page: number) =>
        client.users
          .list({ query: { ...firstPage, page, pageSize: 2 } })
          .pipe(
            Effect.map(({ items, total }) => ({ emails: items.map(({ email }) => email), total })),
          );

      assert.deepStrictEqual(yield* pageOf(1), { emails: emailsSorted.slice(0, 2), total: 5 });
      assert.deepStrictEqual(yield* pageOf(2), { emails: emailsSorted.slice(2, 4), total: 5 });
      assert.deepStrictEqual(yield* pageOf(3), { emails: emailsSorted.slice(4), total: 5 });
      assert.deepStrictEqual(yield* pageOf(4), { emails: [], total: 5 });
    }),
  );

  it.effect("sorts by the field and in the direction asked, ties by email, ascending", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(grace);
      const emailsBy = (orderBy: "email" | "role", dir: "asc" | "desc") =>
        client.users
          .list({ query: { ...firstPage, orderBy, dir } })
          .pipe(Effect.map(({ items }) => items.map(({ email }) => email)));
      const userEmails = emailsSorted.filter((email) => email !== grace.email);

      assert.deepStrictEqual(yield* emailsBy("email", "desc"), emailsSorted.toReversed());
      assert.deepStrictEqual(yield* emailsBy("role", "asc"), [grace.email, ...userEmails]);
      assert.deepStrictEqual(yield* emailsBy("role", "desc"), [...userEmails, grace.email]);
    }),
  );

  it.effect("keeps the Users whose email or full name contains the search, whatever its case", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(grace);
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
      assert.deepStrictEqual(yield* search(""), { emails: [ada.email], total: users.length });
    }),
  );

  it.effect("keeps the Users of the Role asked, along with the search", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(grace);
      const filter = (query: { role: Role; search?: string }) =>
        client.users
          .list({ query: { ...firstPage, ...query } })
          .pipe(
            Effect.map(({ items, total }) => ({ emails: items.map(({ email }) => email), total })),
          );

      assert.deepStrictEqual(yield* filter({ role: "admin" }), { emails: [grace.email], total: 1 });
      assert.deepStrictEqual(yield* filter({ role: "user", search: "d" }), {
        emails: [ada.email, edsger.email, linus.email],
        total: 3,
      });
      assert.deepStrictEqual(yield* filter({ role: "admin", search: "ada" }), {
        emails: [],
        total: 0,
      });
    }),
  );

  it.effect("sorts by status, then by email", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(grace);
      const emailsBy = (dir: "asc" | "desc") =>
        client.users
          .list({ query: { ...firstPage, orderBy: "status", dir } })
          .pipe(Effect.map(({ items }) => items.map(({ email }) => email)));

      assert.deepStrictEqual(yield* emailsBy("desc"), [
        linus.email,
        edsger.email,
        ada.email,
        barbara.email,
        grace.email,
      ]);
    }),
  );

  it.effect("sorts by a date, and puts the Users who have none last in either direction", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(grace);
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
    }),
  );

  it.effect("keeps the Users of the status asked", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(grace);
      const emailsWith = (status: UserStatus) =>
        client.users
          .list({ query: { ...firstPage, status } })
          .pipe(Effect.map(({ items }) => items.map(({ email }) => email)));

      assert.deepStrictEqual(yield* emailsWith("suspended"), [linus.email]);
      assert.deepStrictEqual(yield* emailsWith("active"), [ada.email, barbara.email, grace.email]);
    }),
  );

  it.effect("sorts by name, last name first, and by country, those with no Profile last", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(grace);
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
    }),
  );

  it.effect("keeps the Users of the team asked, along with the status", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(grace);
      const emailsWhere = (filters: { status?: UserStatus; team: Team }) =>
        client.users
          .list({ query: { ...firstPage, ...filters } })
          .pipe(Effect.map(({ items }) => items.map(({ email }) => email)));

      assert.deepStrictEqual(yield* emailsWhere({ team: "engineering" }), [
        grace.email,
        linus.email,
      ]);
      assert.deepStrictEqual(yield* emailsWhere({ status: "active", team: "engineering" }), [
        grace.email,
      ]);
    }),
  );

  it.effect("keeps the Users onboarded, or those not yet", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(grace);
      const emailsWhere = (onboarded: boolean) =>
        client.users
          .list({ query: { ...firstPage, onboarded } })
          .pipe(Effect.map(({ items }) => items.map(({ email }) => email)));

      assert.deepStrictEqual(yield* emailsWhere(true), emailsOf(ada, grace));
      assert.deepStrictEqual(yield* emailsWhere(false), emailsOf(barbara, edsger, linus));
    }),
  );

  it.effect("gives an admin a User by their id, with their Profile", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(grace);

      const user = yield* client.users.get({ params: { id: ada.id } });

      assert.deepStrictEqual(user, ada);
    }),
  );

  it.effect("answers UserNotFound, 404, for an id no User has", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(grace);
      const id = UserId.make("nobody");

      const error = yield* client.users.get({ params: { id } }).pipe(Effect.flip);
      const response = yield* client.users.get({ params: { id }, responseMode: "response-only" });

      assert.deepStrictEqual(error, new UserNotFound({ id }));
      assert.strictEqual(response.status, 404);
    }),
  );

  it.effect("refuses a User to a user with Forbidden, 403", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(ada);

      const response = yield* client.users.get({
        params: { id: grace.id },
        responseMode: "response-only",
      });

      assert.strictEqual(response.status, 403);
    }),
  );

  it.effect("refuses a user with Forbidden, 403", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(ada);

      const error = yield* client.users.list({ query: firstPage }).pipe(Effect.flip);
      const response = yield* client.users.list({
        query: firstPage,
        responseMode: "response-only",
      });

      assert.deepStrictEqual(error, new Forbidden());
      assert.strictEqual(response.status, 403);
    }),
  );

  it.effect("refuses a visitor with Unauthenticated, 401", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(undefined);

      const error = yield* client.users.list({ query: firstPage }).pipe(Effect.flip);
      const response = yield* client.users.list({
        query: firstPage,
        responseMode: "response-only",
      });

      assert.deepStrictEqual(error, new Unauthenticated());
      assert.strictEqual(response.status, 401);
    }),
  );
});

// Each test changes a User of its own, which the repository keeps apart from the seeded ones.
const ownUser = (name: string, status: UserStatus = "active") =>
  Effect.gen(function* () {
    const user = userOf(name, { status, createdOn: 6, lastSignInOn: null, profile: null });
    yield* (yield* UserRepository).create(user, "no password");
    return user;
  });

// Apart from the list: these tests change Users, whom the list counts and sorts.
layer(Layer.mergeAll(UsersLayer, HttpServer.layerServices))("UsersApi changes", (it) => {
  it.effect("suspends an active User, and reactivates them", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(grace);
      const target = yield* ownUser("suspend-me");
      const params = { id: target.id };

      const suspended = yield* client.users.update({ params, payload: { status: "suspended" } });
      const stored = yield* client.users.get({ params });
      const reactivated = yield* client.users.update({ params, payload: { status: "active" } });

      assert.strictEqual(suspended.status, "suspended");
      assert.strictEqual(stored.status, "suspended");
      assert.strictEqual(reactivated.status, "active");
    }),
  );

  it.effect("changes the Role of a User, and nothing else", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(grace);
      const target = yield* ownUser("promote-me");

      const user = yield* client.users.update({
        params: { id: target.id },
        payload: { role: "admin" },
      });

      assert.deepStrictEqual(user, new User({ ...target, role: "admin" }));
    }),
  );

  it.effect("refuses to change the status of an invited User, 409, and changes nothing", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(grace);
      const target = yield* ownUser("invited-one", "invited");
      const params = { id: target.id };

      const error = yield* client.users
        .update({ params, payload: { role: "admin", status: "suspended" } })
        .pipe(Effect.flip);
      const response = yield* client.users.update({
        params,
        payload: { status: "active" },
        responseMode: "response-only",
      });

      assert.deepStrictEqual(error, new UserInvited({ id: target.id }));
      assert.strictEqual(response.status, 409);
      assert.deepStrictEqual(yield* client.users.get({ params }), target);
    }),
  );

  it.effect("changes the Role of an invited User", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(grace);
      const target = yield* ownUser("invited-admin", "invited");

      const user = yield* client.users.update({
        params: { id: target.id },
        payload: { role: "admin" },
      });

      assert.strictEqual(user.role, "admin");
    }),
  );

  it.effect("refuses an admin a change of their own access, 403", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(grace);
      const params = { id: grace.id };

      const error = yield* client.users
        .update({ params, payload: { status: "suspended" } })
        .pipe(Effect.flip);
      const response = yield* client.users.update({
        params,
        payload: { role: "user" },
        responseMode: "response-only",
      });

      assert.deepStrictEqual(error, new CannotChangeOwnAccess());
      assert.strictEqual(response.status, 403);
      assert.deepStrictEqual(yield* client.users.get({ params }), grace);
    }),
  );

  it.effect("answers UserNotFound, 404, for a change to an id no User has", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(grace);
      const id = UserId.make("nobody");

      const error = yield* client.users
        .update({ params: { id }, payload: { role: "admin" } })
        .pipe(Effect.flip);

      assert.deepStrictEqual(error, new UserNotFound({ id }));
    }),
  );

  it.effect("refuses a user every change with Forbidden, 403", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(ada);
      const target = yield* ownUser("not-by-ada");

      const error = yield* client.users
        .update({ params: { id: target.id }, payload: { status: "suspended" } })
        .pipe(Effect.flip);

      assert.deepStrictEqual(error, new Forbidden());
    }),
  );
});
