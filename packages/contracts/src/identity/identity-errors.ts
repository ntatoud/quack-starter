import { Schema } from "effect";

/** A User already signed up with this email. */
export class EmailAlreadyTaken extends Schema.TaggedError<
  EmailAlreadyTaken,
  { readonly brand: unique symbol }
>()("EmailAlreadyTaken", {}) {}
