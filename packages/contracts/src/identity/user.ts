import { Schema, SchemaTransformation } from "effect";

import { Profile } from "#/identity/profile.ts";

export const UserId = Schema.String.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

/** Deliberately loose: only a message sent to the address proves it exists. */
export const Email = Schema.String.pipe(
  Schema.decode(SchemaTransformation.trim()),
  Schema.decode(SchemaTransformation.toLowerCase()),
)
  .check(
    Schema.isPattern(/^[^@]+@[^@]+$/, {
      message: "Enter an email address, like name@example.com",
    }),
    Schema.isMaxLength(254, { message: "Email must be at most 254 characters" }),
  )
  .pipe(Schema.brand("Email"));
export type Email = typeof Email.Type;

/** No trim: a space is a valid character. */
export const Password = Schema.RedactedFromValue(
  Schema.String.check(
    Schema.isMinLength(12, { message: "Password must be at least 12 characters" }),
    Schema.isMaxLength(128, { message: "Password must be at most 128 characters" }),
  ),
);
export type Password = typeof Password.Type;

export const Role = Schema.Literals(["user", "admin"]);
export type Role = typeof Role.Type;

/** Only an `active` User signs in: an `invited` one has not chosen a password yet, a `suspended` one is refused by an Admin. */
export const UserStatus = Schema.Literals(["active", "invited", "suspended"]);
export type UserStatus = typeof UserStatus.Type;

export class User extends Schema.Class<User, { readonly brand: unique symbol }>("User")({
  id: UserId,
  email: Email,
  role: Role,
  status: UserStatus,
  createdAt: Schema.DateTimeUtcFromString,
  lastSignInAt: Schema.NullOr(Schema.DateTimeUtcFromString),
  emailVerifiedAt: Schema.NullOr(Schema.DateTimeUtcFromString),
  /** `null` until the User fills it in: a sign-up asks for an email and a password only. */
  profile: Schema.NullOr(Profile),
}) {}
