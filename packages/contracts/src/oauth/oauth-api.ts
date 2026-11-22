import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";

import { Authentication } from "#/identity/authentication.ts";
import { AuthorizationRequest, AuthorizationRequestParams } from "#/oauth/authorization-request.ts";
import { AuthorizationRequestRefused } from "#/oauth/oauth-errors.ts";
import { RequiredPermission } from "#/permission.ts";

export class OAuthApi extends HttpApiGroup.make("oauth")
  .add(
    /**
     * Validates the authorization request of an AI Client, fetching the document that describes it,
     * and answers with what the consent page shows. Behind `Authentication`, so a visitor never makes
     * Quack fetch an address.
     */
    HttpApiEndpoint.post("checkAuthorization", "/authorize/check", {
      payload: AuthorizationRequestParams,
      success: AuthorizationRequest,
      error: AuthorizationRequestRefused.pipe(HttpApiSchema.status(400)),
    }).annotate(RequiredPermission, "none"),
  )
  .middleware(Authentication)
  .prefix("/oauth") {}
