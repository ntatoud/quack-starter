import { Schema } from "effect";

import { Permission } from "#/permission.ts";

export class Unauthenticated extends Schema.TaggedError<
  Unauthenticated,
  { readonly brand: unique symbol }
>()("Unauthenticated", {}) {}

export class EmailAlreadyTaken extends Schema.TaggedError<
  EmailAlreadyTaken,
  { readonly brand: unique symbol }
>()("EmailAlreadyTaken", {}) {}

/** One error for both cases: the answer does not say whether a User has the email. */
export class InvalidCredentials extends Schema.TaggedError<
  InvalidCredentials,
  { readonly brand: unique symbol }
>()("InvalidCredentials", {}) {}

/** The current password a signed-in User typed to confirm a change is not theirs. */
export class WrongPassword extends Schema.TaggedError<
  WrongPassword,
  { readonly brand: unique symbol }
>()("WrongPassword", {}) {}

/** A link sent by email that was used, has expired, or never existed: the answer does not say which. */
export class ExpiredLink extends Schema.TaggedError<
  ExpiredLink,
  { readonly brand: unique symbol }
>()("ExpiredLink", {}) {}

export class TooManyAttempts extends Schema.TaggedError<
  TooManyAttempts,
  { readonly brand: unique symbol }
>()("TooManyAttempts", {
  /** Seconds. */
  retryAfter: Schema.Int,
}) {}

/** The caller is known, but lacks the Permission the endpoint requires. */
export class Forbidden extends Schema.TaggedError<Forbidden, { readonly brand: unique symbol }>()(
  "Forbidden",
  {
    /** Absent when the endpoint declares no Permission, which refuses every caller. */
    permission: Schema.optionalKey(Permission),
  },
) {
  override get message() {
    return this.permission === undefined
      ? "No Permission opens this endpoint"
      : `The Permission ${this.permission} is required`;
  }
}
