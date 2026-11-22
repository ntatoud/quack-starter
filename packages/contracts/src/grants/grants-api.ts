import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";

import { Grant, GrantId } from "#/grants/grant.ts";
import { GrantNotFound } from "#/grants/grant-errors.ts";
import { Authentication } from "#/identity/authentication.ts";
import { RequiredPermission } from "#/permission.ts";

/** The Current User's own Grants: no McpTool, so no AI Client lists or revokes them. */
export class GrantsApi extends HttpApiGroup.make("grants")
  .add(
    /** Those still active: an expired Grant opens nothing, and its AI Client must ask again. */
    HttpApiEndpoint.get("list", "/", {
      success: Schema.Array(Grant),
    }).annotate(RequiredPermission, "none"),
    /** Cuts the AI Client off at once: its tokens go with the Grant. */
    HttpApiEndpoint.delete("revoke", "/:id", {
      params: { id: GrantId },
      success: HttpApiSchema.NoContent,
      error: GrantNotFound.pipe(HttpApiSchema.status(404)),
    }).annotate(RequiredPermission, "none"),
  )
  .middleware(Authentication)
  .prefix("/grants") {}
