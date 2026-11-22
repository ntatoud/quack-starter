import type { Permission } from "@quack/contracts/permission";
import type { AuthorizationRequestParams } from "@quack/contracts/oauth/authorization-request";
import {
  type AuthorizationErrorCode,
  AuthorizationRequestRefused,
} from "@quack/contracts/oauth/oauth-errors";
import { Context, Effect, Option, Schema } from "effect";

import { type GrantTerms, grantablePermissions } from "#/modules/identity/domain/grant.ts";
import { isLoopback, redirectUriMatches } from "#/modules/identity/domain/redirect-uri.ts";

/** The document an AI Client is known by, served at its `client_id` (Client ID Metadata Document). */
const AiClientDocument = Schema.Struct({
  client_id: Schema.String,
  client_name: Schema.NonEmptyString,
  redirect_uris: Schema.NonEmptyArray(Schema.String),
  token_endpoint_auth_method: Schema.optionalKey(Schema.String),
});

export class AiClientDocumentUnavailable extends Schema.TaggedError<AiClientDocumentUnavailable>()(
  "AiClientDocumentUnavailable",
  { reason: Schema.String },
) {}

/** Answers with the JSON as fetched: what it holds is checked by `checkAuthorizationRequest`. */
export class AiClientDocuments extends Context.Service<
  AiClientDocuments,
  {
    fetch(url: URL): Effect.Effect<Schema.Json, AiClientDocumentUnavailable>;
    /** The document while it is still fresh from an earlier fetch, without fetching it. */
    cached(url: URL): Effect.Effect<Option.Option<Schema.Json>>;
  }
>()("@quack/server/identity/AiClientDocuments") {}

const refused = (error: AuthorizationErrorCode, description: string, redirectUri?: string) =>
  redirectUri === undefined
    ? new AuthorizationRequestRefused({ error, error_description: description })
    : new AuthorizationRequestRefused({
        error,
        error_description: description,
        redirect_uri: redirectUri,
      });

// What an AI Client that holds a secret uses: one served from a public document cannot keep it.
const sharedSecretMethods = new Set([
  "client_secret_basic",
  "client_secret_post",
  "client_secret_jwt",
]);

// RFC 7636 s4.2: the base64url of a SHA-256, unpadded.
const s256Challenge = /^[A-Za-z0-9_-]{43}$/;

export interface AuthorizationServer {
  readonly issuer: string;
  readonly mcpResource: string;
  /** Lets an AI Client run on this machine, such as a local MCP Inspector, serve its document over `http`. */
  readonly allowLoopbackHttpDocuments: boolean;
}

/** The address of the document to fetch, refused before any fetch when it could not be an AI Client's. */
export const aiClientUrlOf = (clientId: string | undefined, server: AuthorizationServer) => {
  if (clientId === undefined)
    return Effect.fail(refused("invalid_request", "client_id is missing"));
  const url = URL.parse(clientId);

  if (url === null) return Effect.fail(refused("invalid_client", "client_id is not a URL"));
  const isHttps = url.protocol === "https:";

  const isLocalHttp =
    url.protocol === "http:" && server.allowLoopbackHttpDocuments && isLoopback(url);

  if (!isHttps && !isLocalHttp) {
    return Effect.fail(refused("invalid_client", "client_id must be an https URL"));
  }

  if (url.username !== "" || url.password !== "" || clientId.includes("#")) {
    return Effect.fail(refused("invalid_client", "client_id must have no credentials or fragment"));
  }

  if (url.pathname === "/") {
    return Effect.fail(refused("invalid_client", "client_id must have a path"));
  }

  if (url.origin === new URL(server.issuer).origin) {
    return Effect.fail(refused("invalid_client", "client_id must not be Quack's own address"));
  }

  return Effect.succeed(url);
};

/** Where an authorization response may go: an https address, or one on the User's machine (RFC 8252 s7.3). */
const isRedirectable = (uri: string) => {
  const url = URL.parse(uri);

  return (
    url !== null &&
    !uri.includes("#") &&
    (url.protocol === "https:" || (url.protocol === "http:" && isLoopback(url)))
  );
};

const permissionsOf = (scope: string | undefined): Option.Option<ReadonlyArray<Permission>> => {
  const requested = new Set((scope ?? "").split(" ").filter((name) => name !== ""));
  const grantable: ReadonlySet<string> = new Set(grantablePermissions);

  return requested.size > 0 && [...requested].every((name) => grantable.has(name))
    ? Option.some(grantablePermissions.filter((permission) => requested.has(permission)))
    : Option.none();
};

/** An authorization request Quack has verified: the AI Client's document lists its redirect URI. */
export interface ValidAuthorizationRequest extends GrantTerms {
  readonly aiClient: {
    readonly id: string;
    readonly host: string;
    readonly name: string;
  };
  readonly redirectHost: string;
  readonly loopbackOnly: boolean;
  readonly codeChallenge: string;
  readonly state: string | undefined;
}

export const checkAuthorizationRequest = Effect.fn(function* (
  params: AuthorizationRequestParams,
  clientId: URL,
  fetched: Schema.Json,
  server: AuthorizationServer,
) {
  const document = Schema.decodeUnknownOption(AiClientDocument)(fetched);

  if (Option.isNone(document)) {
    return yield* refused(
      "invalid_client",
      "The AI Client's document must have a client_name and redirect_uris",
    );
  }

  const { client_id, client_name, redirect_uris, token_endpoint_auth_method } = document.value;

  if (client_id !== params.client_id) {
    return yield* refused("invalid_client", "The AI Client's document is not at its client_id");
  }

  if (
    token_endpoint_auth_method !== undefined &&
    sharedSecretMethods.has(token_endpoint_auth_method)
  ) {
    return yield* refused("invalid_client", "An AI Client must not authenticate with a secret");
  }

  const redirectUri = params.redirect_uri;

  if (redirectUri === undefined)
    return yield* refused("invalid_request", "redirect_uri is missing");

  if (
    !isRedirectable(redirectUri) ||
    !redirect_uris.some((listed) => redirectUriMatches(listed, redirectUri))
  ) {
    return yield* refused("invalid_request", "redirect_uri is not one of the AI Client's");
  }

  // Past this point, the redirect URI is the AI Client's: an error may go back to it.
  if (params.response_type !== "code") {
    return yield* refused("unsupported_response_type", "response_type must be code", redirectUri);
  }

  const codeChallenge = params.code_challenge;

  if (
    params.code_challenge_method !== "S256" ||
    codeChallenge === undefined ||
    !s256Challenge.test(codeChallenge)
  ) {
    return yield* refused("invalid_request", "An S256 code_challenge is required", redirectUri);
  }

  const resource = params.resource;

  if (resource !== server.mcpResource) {
    return yield* refused("invalid_target", `resource must be ${server.mcpResource}`, redirectUri);
  }

  const permissions = permissionsOf(params.scope);

  if (Option.isNone(permissions)) {
    return yield* refused(
      "invalid_scope",
      `scope must name some of: ${grantablePermissions.join(" ")}`,
      redirectUri,
    );
  }

  return {
    aiClient: { id: client_id, host: clientId.hostname, name: client_name },
    aiClientId: client_id,
    redirectUri,
    redirectHost: new URL(redirectUri).hostname,
    loopbackOnly: redirect_uris.every((listed) => {
      const url = URL.parse(listed);

      return url !== null && isLoopback(url);
    }),
    resource,
    permissions: permissions.value,
    codeChallenge,
    state: params.state,
  } satisfies ValidAuthorizationRequest;
});
