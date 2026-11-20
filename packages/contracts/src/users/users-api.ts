import { Schema, SchemaTransformation } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";

import { Authentication } from "#/identity/authentication.ts";
import { RequireRole } from "#/identity/require-role.ts";
import { Team } from "#/identity/profile.ts";
import { Role, User, UserId, UserStatus } from "#/identity/user.ts";
import { Paginated, PaginationQuery } from "#/pagination/paginated.ts";
import { sortingFields } from "#/sorting/sorting.ts";
import { UserNotFound } from "#/users/user-errors.ts";

export class UserList extends Schema.Class<UserList, { readonly brand: unique symbol }>("UserList")(
  Paginated(User).fields,
) {}

/** `name` sorts by last name, then first name. A User with no value for the field comes last, in either direction. */
export const UserOrder = Schema.Literals([
  "email",
  "name",
  "role",
  "status",
  "team",
  "country",
  "createdAt",
  "onboardedAt",
  "lastSignInAt",
]);
export type UserOrder = typeof UserOrder.Type;

/** Matches the Users whose email or full name contains it, whatever its case. */
export const UserSearch = Schema.String.pipe(
  Schema.decode(SchemaTransformation.trim()),
  Schema.decode(SchemaTransformation.toLowerCase()),
).check(Schema.isMaxLength(254));

export const UserListQuery = Schema.Struct({
  ...PaginationQuery.fields,
  search: Schema.optionalKey(UserSearch),
  status: Schema.optionalKey(UserStatus),
  role: Schema.optionalKey(Role),
  team: Schema.optionalKey(Team),
  onboarded: Schema.optionalKey(Schema.Boolean),
  ...sortingFields(UserOrder.literals, "email"),
});
export type UserListQuery = typeof UserListQuery.Type;

const NotFound = UserNotFound.pipe(HttpApiSchema.status(404));

export class UsersApi extends HttpApiGroup.make("users")
  .add(
    HttpApiEndpoint.get("list", "/", {
      query: UserListQuery,
      success: UserList,
    }),
    HttpApiEndpoint.get("get", "/:id", {
      params: { id: UserId },
      success: User,
      error: NotFound,
    }),
  )
  .middleware(RequireRole("admin"))
  .middleware(Authentication)
  .prefix("/users") {}
