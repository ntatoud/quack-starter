import { Schema } from "effect";

import { UserId } from "#/identity/user.ts";

export class UserNotFound extends Schema.TaggedError<
  UserNotFound,
  { readonly brand: unique symbol }
>()("UserNotFound", {
  id: UserId,
}) {}
