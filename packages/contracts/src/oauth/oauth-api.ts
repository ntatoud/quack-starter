import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";

import { Authentication } from "#/identity/authentication.ts";
import {
  AuthorizationDecision,
  AuthorizationRedirect,
  AuthorizationRequest,
  AuthorizationRequestParams,
} from "#/oauth/authorization-request.ts";
import {
  AuthorizationRequestRefused,
  InvalidCsrfToken,
  TokenRequestRefused,
} from "#/oauth/oauth-errors.ts";
import { TokenRequestParams, TokenResponse } from "#/oauth/token-request.ts";
import { RequiredPermission } from "#/permission.ts";

const decisionErrors = [
  AuthorizationRequestRefused.pipe(HttpApiSchema.status(400)),
  InvalidCsrfToken.pipe(HttpApiSchema.status(403)),
];

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
    /**
     * The User approves the request: answers with its redirect URI, carrying a single-use
     * authorization code, the `state`, and `iss`.
     */
    HttpApiEndpoint.post("approveAuthorization", "/authorize/approve", {
      payload: AuthorizationDecision,
      success: AuthorizationRedirect,
      error: decisionErrors,
    }).annotate(RequiredPermission, "none"),
    /** The User denies the request: answers with its redirect URI, carrying `error=access_denied`. */
    HttpApiEndpoint.post("denyAuthorization", "/authorize/deny", {
      payload: AuthorizationDecision,
      success: AuthorizationRedirect,
      error: decisionErrors,
    }).annotate(RequiredPermission, "none"),
  )
  .middleware(Authentication)
  .add(
    /**
     * An AI Client exchanges its authorization code for an access token. After `Authentication`, which
     * it skips: the AI Client has no Session, and proves itself by the code and its PKCE verifier.
     */
    HttpApiEndpoint.post("token", "/token", {
      payload: TokenRequestParams,
      success: TokenResponse,
      error: TokenRequestRefused.pipe(HttpApiSchema.status(400)),
    }),
  )
  .prefix("/oauth") {}
