import { Schema } from "effect";

import { GrantId } from "#/grants/grant.ts";
import { Permission } from "#/permission.ts";

export class GrantNotFound extends Schema.TaggedError<
  GrantNotFound,
  { readonly brand: unique symbol }
>()("GrantNotFound", {
  id: GrantId,
}) {
  override get message() {
    return `No Grant has the id ${this.id}`;
  }
}

/** A Grant holds only the Permissions of the contexts exposed to AI Clients. */
export class PermissionNotGrantable extends Schema.TaggedError<
  PermissionNotGrantable,
  { readonly brand: unique symbol }
>()("PermissionNotGrantable", {
  permission: Permission,
}) {
  override get message() {
    return `No Grant may hold ${this.permission}`;
  }
}
