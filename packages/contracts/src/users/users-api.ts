import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { Authentication } from "#/identity/authentication.ts";
import { RequireRole } from "#/identity/require-role.ts";
import { User } from "#/identity/user.ts";
import { Paginated, PaginationQuery } from "#/pagination/paginated.ts";

export class UserList extends Schema.Class<UserList, { readonly brand: unique symbol }>("UserList")(
  Paginated(User).fields,
) {}

export class UsersApi extends HttpApiGroup.make("users")
  .add(
    HttpApiEndpoint.get("list", "/", {
      query: PaginationQuery,
      success: UserList,
    }),
  )
  .middleware(RequireRole("admin"))
  .middleware(Authentication)
  .prefix("/users") {}
