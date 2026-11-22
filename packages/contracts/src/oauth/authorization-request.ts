import { Schema } from "effect";

import { Permission } from "#/permission.ts";

/**
 * The query of the authorization URL an AI Client sends the User to, as is: every parameter is
 * optional here, so a missing or malformed one is refused as an OAuth error, not a schema error.
 */
export const AuthorizationRequestParams = Schema.Struct({
  client_id: Schema.optionalKey(Schema.String),
  redirect_uri: Schema.optionalKey(Schema.String),
  response_type: Schema.optionalKey(Schema.String),
  code_challenge: Schema.optionalKey(Schema.String),
  code_challenge_method: Schema.optionalKey(Schema.String),
  resource: Schema.optionalKey(Schema.String),
  scope: Schema.optionalKey(Schema.String),
  /** Opaque to Quack: sent back as is with the authorization response. */
  state: Schema.optionalKey(Schema.String),
});

export type AuthorizationRequestParams = typeof AuthorizationRequestParams.Type;

/** What the consent page shows of a valid authorization request. */
export class AuthorizationRequest extends Schema.Class<
  AuthorizationRequest,
  { readonly brand: unique symbol }
>("AuthorizationRequest")({
  aiClient: Schema.Struct({
    /** The address of its document, which is the AI Client. */
    id: Schema.String,
    /** The hostname of `id`: the only part of the AI Client Quack has verified. */
    host: Schema.String,
    /** What the AI Client says it is, unverified. */
    name: Schema.String,
  }),
  redirectHost: Schema.String,
  /** Every redirect URI of the document is on this machine: anything running here could be the AI Client. */
  loopbackOnly: Schema.Boolean,
  permissions: Schema.Array(Permission),
  /** Those of the Grant the User already gave this AI Client, `null` if none. */
  grantedPermissions: Schema.NullOr(Schema.Array(Permission)),
  /** The User already gave this consent and Quack remembers it: the page approves without asking. */
  consentRemembered: Schema.Boolean,
  /** What the page sends back with the User's decision, which proves the decision was made on it. */
  csrfToken: Schema.String,
}) {}

/** The User's decision on an authorization request: the request again, since Quack keeps none of it. */
export const AuthorizationDecision = Schema.Struct({
  ...AuthorizationRequestParams.fields,
  csrfToken: Schema.String,
});

/** The authorization response: where the page sends the User, back to the AI Client. */
export const AuthorizationRedirect = Schema.Struct({ redirectTo: Schema.String });
