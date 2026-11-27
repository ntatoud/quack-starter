import { Schema, SchemaTransformation } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";

import { Authentication } from "#/identity/authentication.ts";
import { Unauthenticated } from "#/identity/identity-errors.ts";
import { PersonName, Profile, Team } from "#/identity/profile.ts";
import { Role, TimeZone, User, UserId, UserStatus } from "#/identity/user.ts";
import { Paginated, PaginationQuery } from "#/pagination/paginated.ts";
import { RequiredPermission } from "#/permission.ts";
import { sortingFields } from "#/sorting/sorting.ts";
import {
  CannotChangeOwnAccess,
  CannotDeleteSelf,
  UserInvited,
  UserNotFound,
} from "#/users/user-errors.ts";

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
const OwnAccess = CannotChangeOwnAccess.pipe(HttpApiSchema.status(403));
const DeleteSelf = CannotDeleteSelf.pipe(HttpApiSchema.status(403));
const Invited = UserInvited.pipe(HttpApiSchema.status(409));

/** What an Admin changes on a User, a field or more. `invited` is no choice: the User leaves it by choosing a password. */
export const UserChanges = Schema.Struct({
  role: Schema.optionalKey(Role),
  status: Schema.optionalKey(Schema.Literals(["active", "suspended"])),
});

export type UserChanges = typeof UserChanges.Type;

export const TimeZonePayload = Schema.Struct({ timeZone: TimeZone });

/** Trims what was typed, then decodes it with `schema`, whose `Schema.Trimmed` would only refuse the spaces. */
const trimmed = <S extends Schema.Codec<string, string>>(schema: S) =>
  Schema.String.pipe(Schema.decodeTo(schema, SchemaTransformation.trim()));

/** What the onboarding asks for: the fields a Profile requires. */
export const OnboardingPayload = Schema.Struct({
  firstName: trimmed(PersonName),
  lastName: trimmed(PersonName),
});

export type OnboardingPayload = typeof OnboardingPayload.Type;

const SignedOut = Unauthenticated.pipe(HttpApiSchema.status(401));

// The Current User's own endpoints are added after the prefix, which covers the endpoints added before it only:
// their paths stay under `/me`.
export class UsersApi extends HttpApiGroup.make("users")
  .add(
    HttpApiEndpoint.get("list", "/", {
      query: UserListQuery,
      success: UserList,
    }).annotate(RequiredPermission, "users:list"),
    HttpApiEndpoint.get("get", "/:id", {
      params: { id: UserId },
      success: User,
      error: NotFound,
    }).annotate(RequiredPermission, "users:read"),
    /** Suspending ends the Sessions of the User at their next request. */
    HttpApiEndpoint.patch("update", "/:id", {
      params: { id: UserId },
      payload: UserChanges,
      success: User,
      error: [NotFound, OwnAccess, Invited],
    }).annotate(RequiredPermission, "users:write"),
    HttpApiEndpoint.delete("remove", "/:id", {
      params: { id: UserId },
      success: HttpApiSchema.NoContent,
      error: [NotFound, DeleteSelf],
    }).annotate(RequiredPermission, "users:delete"),
  )
  .prefix("/users")
  .add(
    /** Replaces the whole Profile of the Current User, and answers with their User. */
    HttpApiEndpoint.put("updateProfile", "/me/profile", {
      payload: Profile,
      success: User,
      error: SignedOut,
    }).annotate(RequiredPermission, "none"),
    HttpApiEndpoint.put("updateTimeZone", "/me/time-zone", {
      payload: TimeZonePayload,
      success: User,
      error: SignedOut,
    }).annotate(RequiredPermission, "none"),
    HttpApiEndpoint.post("completeOnboarding", "/me/onboarding", {
      payload: OnboardingPayload,
      success: User,
      error: SignedOut,
    }).annotate(RequiredPermission, "none"),
  )
  .middleware(Authentication) {}
