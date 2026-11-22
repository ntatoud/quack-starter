import { API_PREFIX, MCP_PATH } from "@quack/contracts/api";
import { Effect } from "effect";
import { HttpMiddleware, HttpRouter, HttpServerResponse } from "effect/http";

import { ServerConfig } from "#/config.ts";
import { basicPermissions, grantablePermissions } from "#/modules/identity/domain/grant.ts";

// AI Clients read them from any origin, a browser among them, and they hold nothing of a User's.
const readableByAnyOrigin = HttpMiddleware.cors({ allowedMethods: ["GET"] });

type WellKnownDocument = Readonly<Record<string, string | boolean | ReadonlyArray<string>>>;

const wellKnownDocument = (path: `/${string}`, body: WellKnownDocument) => {
  const respond = readableByAnyOrigin(Effect.succeed(HttpServerResponse.jsonUnsafe(body)));

  return [HttpRouter.route("GET", path, respond), HttpRouter.route("OPTIONS", path, respond)];
};

/**
 * The documents AI Clients discover Quack by (RFC 8414 and RFC 9728), at the root of the public origin,
 * where an AI Client looks for them from the issuer and the resource.
 */
export const OAuthMetadataRoutes = HttpRouter.addAll(
  Effect.gen(function* () {
    const publicOrigin = yield* ServerConfig.publicOrigin;

    return [
      ...wellKnownDocument("/.well-known/oauth-authorization-server", {
        issuer: publicOrigin,
        authorization_endpoint: `${publicOrigin}/oauth/authorize`,
        token_endpoint: `${publicOrigin}${API_PREFIX}/oauth/token`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"],
        client_id_metadata_document_supported: true,
        authorization_response_iss_parameter_supported: true,
        scopes_supported: grantablePermissions,
      }),
      ...wellKnownDocument(`/.well-known/oauth-protected-resource${MCP_PATH}`, {
        resource: `${publicOrigin}${MCP_PATH}`,
        authorization_servers: [publicOrigin],
        scopes_supported: basicPermissions,
        bearer_methods_supported: ["header"],
      }),
    ];
  }),
);
