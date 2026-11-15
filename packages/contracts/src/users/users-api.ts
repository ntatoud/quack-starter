import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { Authentication } from "#/identity/authentication.ts";
import { RequireRole } from "#/identity/require-role.ts";
import { User } from "#/identity/user.ts";
import { Paginated, PaginationQuery } from "#/pagination/paginated.ts";
import { sortingFields } from "#/pagination/sorting.ts";

export class UserList extends Schema.Class<UserList, { readonly brand: unique symbol }>("UserList")(
  Paginated(User).fields,
) {}

export const UserOrder = Schema.Literals(["email", "role"]);
export type UserOrder = typeof UserOrder.Type;

export const UserListQuery = Schema.Struct({
  ...PaginationQuery.fields,
  ...sortingFields(UserOrder.literals, "email"),
});
export type UserListQuery = typeof UserListQuery.Type;

export class UsersApi extends HttpApiGroup.make("users")
  .add(
    HttpApiEndpoint.get("list", "/", {
      query: UserListQuery,
      success: UserList,
    }),
  )
  .middleware(RequireRole("admin"))
  .middleware(Authentication)
  .prefix("/users") {}
