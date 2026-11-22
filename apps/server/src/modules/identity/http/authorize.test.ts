import { assert, describe, it } from "@effect/vitest";
import { Authentication } from "@quack/contracts/identity/authentication";
import { Forbidden } from "@quack/contracts/identity/identity-errors";
import { RequiredPermission } from "@quack/contracts/permission";
import { Effect } from "effect";
import { HttpApiEndpoint } from "effect/http-api";

import { rolePermissions } from "#/modules/identity/domain/role-permissions.ts";
import { accessTo, authorize } from "#/modules/identity/http/authorize.ts";

const listUsers = HttpApiEndpoint.get("listUsers", "/users")
  .annotate(RequiredPermission, "users:list")
  .middleware(Authentication);

describe("authorize", () => {
  it.effect("lets through a caller whose Role gives the Permission of the endpoint", () =>
    authorize(listUsers, rolePermissions("admin")),
  );

  it.effect("refuses a caller whose Role lacks it with Forbidden, naming the Permission", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(authorize(listUsers, rolePermissions("user")));

      assert.deepStrictEqual(error, new Forbidden({ permission: "users:list" }));
    }),
  );

  it.effect("lets through any caller to an endpoint that needs no Permission", () =>
    authorize(
      HttpApiEndpoint.get("me", "/me")
        .annotate(RequiredPermission, "none")
        .middleware(Authentication),
      rolePermissions("user"),
    ),
  );

  it.effect("refuses every caller, admin included, to an endpoint that declares nothing", () =>
    Effect.gen(function* () {
      const undeclared = HttpApiEndpoint.get("undeclared", "/undeclared").middleware(
        Authentication,
      );

      const error = yield* Effect.flip(authorize(undeclared, rolePermissions("admin")));

      assert.deepStrictEqual(error, new Forbidden({}));
    }),
  );
});

describe("accessTo", () => {
  const createTodo = HttpApiEndpoint.post("create", "/todos")
    .annotate(RequiredPermission, "todos:write")
    .middleware(Authentication);

  it.effect("allows a Grant that holds the Permission of the endpoint", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* accessTo(createTodo, new Set(["todos:write"])), {
        _tag: "Allowed",
      });
    }),
  );

  it.effect("steps up a Grant that lacks it, asking for what it holds as well", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* accessTo(createTodo, new Set(["todos:list", "todos:delete"])), {
        _tag: "StepUp",
        scope: ["todos:list", "todos:write", "todos:delete"],
      });
    }),
  );

  it.effect("refuses a Permission no Grant may hold, and an endpoint that declares nothing", () =>
    Effect.gen(function* () {
      const undeclared = HttpApiEndpoint.get("undeclared", "/undeclared").middleware(
        Authentication,
      );

      assert.deepStrictEqual(yield* accessTo(listUsers, new Set(["todos:list"])), {
        _tag: "Refused",
      });
      assert.deepStrictEqual(yield* accessTo(undeclared, new Set(["todos:list"])), {
        _tag: "Refused",
      });
    }),
  );
});
