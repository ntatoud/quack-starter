import { assert, layer } from "@effect/vitest";
import { Api } from "@quack/contracts/api";
import { Authentication, CurrentUser } from "@quack/contracts/identity/authentication";
import { Forbidden, Unauthenticated } from "@quack/contracts/identity/identity-errors";
import { Email, type Role, User, UserId } from "@quack/contracts/identity/user";
import { Effect, Layer, Redacted } from "effect";
import { HttpClientRequest, HttpServer } from "effect/http";
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api";

import { Users } from "#/modules/identity/application/users.ts";
import { UserRepository } from "#/modules/identity/domain/user-repository.ts";
import { RequireAdminMiddleware } from "#/modules/identity/http/require-admin-middleware.ts";
import { UsersHandlers } from "#/modules/identity/http/users-handlers.ts";
import { UserRepositoryMemory } from "#/modules/identity/infrastructure/user-repository-memory.ts";

const userOf = (name: string, role: Role) =>
  new User({ id: UserId.make(name), email: Email.make(`${name}@example.com`), role });

const grace = userOf("grace", "admin");
const ada = userOf("ada", "user");
const users: ReadonlyArray<User> = [
  grace,
  userOf("linus", "user"),
  ada,
  userOf("edsger", "user"),
  userOf("barbara", "user"),
];
const firstPage = { page: 1, pageSize: 20 };
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
  Layer.provide(Layer.provideMerge(SeededUsers, UserRepositoryMemory)),
  Layer.provideMerge(RequireAdminMiddleware),
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
          .list({ query: { page, pageSize: 2 } })
          .pipe(
            Effect.map(({ items, total }) => ({ emails: items.map(({ email }) => email), total })),
          );

      assert.deepStrictEqual(yield* pageOf(1), { emails: emailsSorted.slice(0, 2), total: 5 });
      assert.deepStrictEqual(yield* pageOf(2), { emails: emailsSorted.slice(2, 4), total: 5 });
      assert.deepStrictEqual(yield* pageOf(3), { emails: emailsSorted.slice(4), total: 5 });
      assert.deepStrictEqual(yield* pageOf(4), { emails: [], total: 5 });
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
