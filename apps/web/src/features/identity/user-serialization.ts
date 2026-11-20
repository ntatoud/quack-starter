import { User } from "@quack/contracts/identity/user";
import { createSerializationAdapter } from "@tanstack/react-router";
import { Schema } from "effect";

/** A User crosses from the server render to the browser encoded, and arrives decoded, its getters included. */
export const userSerialization = createSerializationAdapter({
  key: "quack-user",
  test: (value): value is User => value instanceof User,
  toSerializable: (user) => Schema.encodeSync(User)(user),
  fromSerializable: (encoded) => Schema.decodeSync(User)(encoded),
});
