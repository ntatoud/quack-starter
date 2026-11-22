import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";

import { Authentication } from "#/identity/authentication.ts";
import { TooManyAttempts } from "#/identity/identity-errors.ts";
import {
  AuthorizationApproval,
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

/**
 * `TooManyAttempts` as the token endpoint answers it: an OAuth error (RFC 6749 s5.2), whose AI Client may not
 * know Quack's errors, with 429 and `Retry-After` (RFC 6585 s4).
 */
const TokenRequestThrottled = TooManyAttempts.pipe(
  HttpApiSchema.encodeToWithHeaders(
    {
      body: Schema.Struct({
        error: Schema.Literal("invalid_request"),
        error_description: Schema.String,
      }).pipe(HttpApiSchema.status(429)),
      headers: { "retry-after": Schema.Int },
    },
    {
      decode: ({ headers }) => new TooManyAttempts({ retryAfter: headers["retry-after"] }),
      encode: ({ retryAfter }) => ({
        body: {
          error: "invalid_request" as const,
          error_description: `Too many attempts, retry in ${retryAfter} seconds`,
        },
        headers: { "retry-after": retryAfter },
      }),
    },
  ),
);

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
      error: [
        AuthorizationRequestRefused.pipe(HttpApiSchema.status(400)),
        // Past the fetches of documents a User may cause: the cached ones do not count.
        TooManyAttempts.pipe(HttpApiSchema.status(429)),
      ],
    }).annotate(RequiredPermission, "none"),
    /**
     * The User approves the request with the Permissions they chose: answers with its redirect URI,
     * carrying a single-use authorization code, the `state`, and `iss`.
     */
    HttpApiEndpoint.post("approveAuthorization", "/authorize/approve", {
      payload: AuthorizationApproval,
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
      error: [TokenRequestRefused.pipe(HttpApiSchema.status(400)), TokenRequestThrottled],
    }),
  )
  .prefix("/oauth") {}
