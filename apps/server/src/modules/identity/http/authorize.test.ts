import { assert, describe, it } from "@effect/vitest";
import { Authentication } from "@quack/contracts/identity/authentication";
import { Forbidden } from "@quack/contracts/identity/identity-errors";
import { Email, type Role, User, UserId } from "@quack/contracts/identity/user";
import { RequiredPermission } from "@quack/contracts/permission";
import { DateTime, Effect } from "effect";
import { HttpApiEndpoint } from "effect/http-api";

import { authorize } from "#/modules/identity/http/authorize.ts";

const callerWith = (role: Role) =>
  new User({
    id: UserId.make(`a-${role}`),
    email: Email.make(`a-${role}@example.com`),
    role,
    status: "active",
    createdAt: DateTime.makeUnsafe("2026-01-01T00:00:00Z"),
    lastSignInAt: null,
    onboardedAt: null,
    profile: null,
  });

const listUsers = HttpApiEndpoint.get("listUsers", "/users")
  .annotate(RequiredPermission, "users:list")
  .middleware(Authentication);

describe("authorize", () => {
  it.effect("lets through a caller whose Role gives the Permission of the endpoint", () =>
    authorize(listUsers, callerWith("admin")),
  );

  it.effect("refuses a caller whose Role lacks it with Forbidden, naming the Permission", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(authorize(listUsers, callerWith("user")));

      assert.deepStrictEqual(error, new Forbidden({ permission: "users:list" }));
    }),
  );

  it.effect("lets through any caller to an endpoint that needs no Permission", () =>
    authorize(
      HttpApiEndpoint.get("me", "/me")
        .annotate(RequiredPermission, null)
        .middleware(Authentication),
      callerWith("user"),
    ),
  );

  it.effect("refuses every caller, admin included, to an endpoint that declares nothing", () =>
    Effect.gen(function* () {
      const undeclared = HttpApiEndpoint.get("undeclared", "/undeclared").middleware(
        Authentication,
      );

      const error = yield* Effect.flip(authorize(undeclared, callerWith("admin")));

      assert.deepStrictEqual(error, new Forbidden({}));
    }),
  );
});
