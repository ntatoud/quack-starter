import { Schema } from "effect";
import { HttpApiSchema } from "effect/http-api";

/**
 * A token request (RFC 6749 s4.1.3), form-urlencoded as OAuth sends it. Every parameter is optional
 * here, so a missing one is refused as an OAuth error, not a schema error.
 */
export const TokenRequestParams = Schema.Struct({
  grant_type: Schema.optionalKey(Schema.String),
  code: Schema.optionalKey(Schema.String),
  redirect_uri: Schema.optionalKey(Schema.String),
  client_id: Schema.optionalKey(Schema.String),
  /** The secret whose S256 hash the authorization request carried (RFC 7636). */
  code_verifier: Schema.optionalKey(Schema.String),
  resource: Schema.optionalKey(Schema.String),
}).pipe(HttpApiSchema.asFormUrlEncoded());

export type TokenRequestParams = typeof TokenRequestParams.Type;

/** The access token of a Grant, as RFC 6749 s5.1 names its fields. */
export const TokenResponse = Schema.Struct({
  access_token: Schema.String,
  token_type: Schema.Literal("Bearer"),
  /** Seconds. */
  expires_in: Schema.Int,
  /** The Permissions of the Grant, space-separated. */
  scope: Schema.String,
});

export type TokenResponse = typeof TokenResponse.Type;
