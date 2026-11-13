import { Schema, SchemaTransformation } from "effect";

export const UserId = Schema.String.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

/**
 * Decoding trims and lowercases, so one address has one spelling.
 * The format rule is deliberately loose: only a message sent to the address proves it exists.
 */
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

/**
 * Length is the only rule: no composition rule, and no trim, since a space is a valid character.
 * Decoded as `Redacted`, so a password does not show in a log or a trace.
 */
export const Password = Schema.RedactedFromValue(
  Schema.String.check(
    Schema.isMinLength(12, { message: "Password must be at least 12 characters" }),
    Schema.isMaxLength(128, { message: "Password must be at most 128 characters" }),
  ),
);
export type Password = typeof Password.Type;

/** The public User: what the API returns. It never carries the password hash. */
export class User extends Schema.Class<User, { readonly brand: unique symbol }>("User")({
  id: UserId,
  email: Email,
}) {}
