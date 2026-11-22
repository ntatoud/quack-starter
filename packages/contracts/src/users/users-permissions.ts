import { Schema } from "effect";

/** `users:write` changes the Role and the Status of a User. */
export const UsersPermission = Schema.Literals([
  "users:list",
  "users:read",
  "users:write",
  "users:delete",
]);

export type UsersPermission = typeof UsersPermission.Type;
