import { Schema } from "effect";

import { Permission } from "#/permission.ts";
import { TodosPermission } from "#/todos/todos-permissions.ts";

/** The Permissions a Grant may hold: those of the contexts exposed to AI Clients, never `users:*`. */
export const grantablePermissions = TodosPermission.literals;

export const GrantId = Schema.String.pipe(Schema.brand("GrantId"));

export type GrantId = typeof GrantId.Type;

/** A Grant of the Current User, as their settings show it. */
export class Grant extends Schema.Class<Grant, { readonly brand: unique symbol }>("Grant")({
  id: GrantId,
  aiClient: Schema.Struct({
    /** The address of its document, which is the AI Client. */
    id: Schema.String,
    /** The hostname of `id`: the only part of the AI Client Quack has verified. */
    host: Schema.String,
    /** What the AI Client said it was when the User last approved, unverified. */
    name: Schema.String,
  }),
  /** The AI Client comes back on this machine: anything running here could be it. */
  loopbackOnly: Schema.Boolean,
  permissions: Schema.Array(Permission),
  /** `null` until the AI Client first calls a tool. */
  lastUsedAt: Schema.NullOr(Schema.DateTimeUtcFromString),
  /** Pushed back by each refresh: an AI Client still in use keeps its Grant. */
  expiresAt: Schema.DateTimeUtcFromString,
}) {}
