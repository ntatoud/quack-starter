import { Schema } from "effect";

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

export class TooManyAttempts extends Schema.TaggedError<
  TooManyAttempts,
  { readonly brand: unique symbol }
>()("TooManyAttempts", {
  /** Seconds. */
  retryAfter: Schema.Int,
}) {}
