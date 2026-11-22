import { Schema } from "effect";

/** The codes of RFC 6749 s4.1.2.1 and RFC 8707 an authorization request is refused with. */
export const AuthorizationErrorCode = Schema.Literals([
  "invalid_request",
  "invalid_client",
  "unsupported_response_type",
  "invalid_scope",
  "invalid_target",
]);

export type AuthorizationErrorCode = typeof AuthorizationErrorCode.Type;

/**
 * An authorization request Quack refuses, as an OAuth error. `redirect_uri` is present once the AI
 * Client and its redirect URI are verified: only then may the error be sent back to the AI Client
 * (RFC 6749 s4.1.2.1); before, the page shows it to the User.
 */
export class AuthorizationRequestRefused extends Schema.TaggedError<
  AuthorizationRequestRefused,
  { readonly brand: unique symbol }
>()("AuthorizationRequestRefused", {
  error: AuthorizationErrorCode,
  error_description: Schema.String,
  redirect_uri: Schema.optionalKey(Schema.String),
}) {}

/** A decision on an authorization request that does not come from the consent page of the User's Session. */
export class InvalidCsrfToken extends Schema.TaggedError<
  InvalidCsrfToken,
  { readonly brand: unique symbol }
>()("InvalidCsrfToken", {}) {}

/** The codes of RFC 6749 s5.2 and RFC 8707 a token request is refused with. */
export const TokenErrorCode = Schema.Literals([
  "invalid_request",
  "invalid_grant",
  "unsupported_grant_type",
  "invalid_target",
]);

/** A token request Quack refuses, as an OAuth error (RFC 6749 s5.2). */
export class TokenRequestRefused extends Schema.TaggedError<
  TokenRequestRefused,
  { readonly brand: unique symbol }
>()("TokenRequestRefused", {
  error: TokenErrorCode,
  error_description: Schema.String,
}) {}
