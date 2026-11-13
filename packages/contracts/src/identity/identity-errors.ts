import { Schema } from "effect";

/** The request carries no Session, or one that is unknown or expired. */
export class Unauthenticated extends Schema.TaggedError<
  Unauthenticated,
  { readonly brand: unique symbol }
>()("Unauthenticated", {}) {}

/** A User already signed up with this email. */
export class EmailAlreadyTaken extends Schema.TaggedError<
  EmailAlreadyTaken,
  { readonly brand: unique symbol }
>()("EmailAlreadyTaken", {}) {}
