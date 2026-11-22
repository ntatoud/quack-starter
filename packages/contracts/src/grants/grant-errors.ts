import { Schema } from "effect";

import { GrantId } from "#/grants/grant.ts";

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
