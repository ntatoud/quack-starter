import { Schema } from "effect";

import { UserId } from "#/identity/user.ts";

export class UserNotFound extends Schema.TaggedError<
  UserNotFound,
  { readonly brand: unique symbol }
>()("UserNotFound", {
  id: UserId,
}) {}

/** An Admin cannot suspend themself, nor change their own Role: they would lose the access to undo it. */
export class CannotChangeOwnAccess extends Schema.TaggedError<
  CannotChangeOwnAccess,
  { readonly brand: unique symbol }
>()("CannotChangeOwnAccess", {}) {}

/** An invited User has not chosen a password yet: they cannot sign in, so their status has nothing to change. */
export class UserInvited extends Schema.TaggedError<
  UserInvited,
  { readonly brand: unique symbol }
>()("UserInvited", { id: UserId }) {}
