import { Schema, SchemaTransformation } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { Authentication } from "#/identity/authentication.ts";
import { RequireRole } from "#/identity/require-role.ts";
import { Role, User } from "#/identity/user.ts";
import { Paginated, PaginationQuery } from "#/pagination/paginated.ts";
import { sortingFields } from "#/sorting/sorting.ts";

export class UserList extends Schema.Class<UserList, { readonly brand: unique symbol }>("UserList")(
  Paginated(User).fields,
) {}

export const UserOrder = Schema.Literals(["email", "role"]);
export type UserOrder = typeof UserOrder.Type;

/** Matches the Users whose email contains it, whatever its case. */
export const UserSearch = Schema.String.pipe(
  Schema.decode(SchemaTransformation.trim()),
  Schema.decode(SchemaTransformation.toLowerCase()),
).check(Schema.isMaxLength(254));

export const UserListQuery = Schema.Struct({
  ...PaginationQuery.fields,
  search: Schema.optionalKey(UserSearch),
  role: Schema.optionalKey(Role),
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
