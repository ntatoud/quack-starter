import { assert, describe, it } from "@effect/vitest";
import { Authentication } from "@quack/contracts/identity/authentication";
import { Forbidden } from "@quack/contracts/identity/identity-errors";
import type { Role } from "@quack/contracts/identity/user";
import { type Permission, RequiredPermission } from "@quack/contracts/permission";
import { Effect } from "effect";
import { HttpApiEndpoint } from "effect/http-api";

import { roleAllows } from "#/modules/identity/domain/role-permissions.ts";
import { authorize } from "#/modules/identity/http/authorize.ts";

const callerWith = (role: Role) => (permission: Permission) => roleAllows(role, permission);

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
        .annotate(RequiredPermission, "none")
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
