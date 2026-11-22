import { brand } from "@quack/brand/brand";
import { MCP_PATH } from "@quack/contracts/api";
import { Effect, Layer, Option, Redacted } from "effect";
import { McpProtocol, McpSchema, McpServer } from "effect/ai";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import { ServerConfig } from "#/config.ts";
import { ContractTools } from "#/mcp/contract-tools.ts";
import { Grants, McpCaller } from "#/modules/identity/index.ts";

const instructions = `${brand.name} manages the Todos of the User who connected you. Call todos_list first.`;

// RFC 6750 s2.1: the scheme is case-insensitive.
const bearer = /^Bearer +(\S+)$/i;

const callerOf = (grants: Grants["Service"], authorization: string | undefined) => {
  const token = bearer.exec(authorization ?? "")?.[1];

  return token === undefined
    ? Effect.succeedNone
    : grants.authenticate(Redacted.make(token)).pipe(Effect.option);
};

/**
 * Lets through to the MCP server only a request from no origin or the public one, carrying the access
 * token of an active Grant. Anything else gets its answer over HTTP, before any JSON-RPC.
 */
const accessToken = (publicOrigin: string) => {
  const resourceMetadata = `resource_metadata="${publicOrigin}/.well-known/oauth-protected-resource${MCP_PATH}"`;

  // RFC 6750 s3: a request with no token gets no error code; one whose token opens nothing, invalid_token.
  const challenge = (authorization: string | undefined) =>
    HttpServerResponse.empty({
      status: 401,
      headers: {
        "www-authenticate":
          authorization === undefined
            ? `Bearer ${resourceMetadata}`
            : `Bearer error="invalid_token", ${resourceMetadata}`,
      },
    });

  return HttpRouter.middleware(
    Effect.gen(function* () {
      const grants = yield* Grants;

      return (toMcpServer) =>
        Effect.gen(function* () {
          const { headers } = yield* HttpServerRequest.HttpServerRequest;

          // A page of another origin is refused before anything else: a browser sends its Origin (DNS rebinding).
          if (headers.origin !== undefined && headers.origin !== publicOrigin) {
            return HttpServerResponse.empty({ status: 403 });
          }

          const caller = yield* callerOf(grants, headers.authorization);

          return Option.isSome(caller) ? yield* toMcpServer : challenge(headers.authorization);
        });
    }),
  );
};

/**
 * Runs each MCP request as the McpCaller of the Grant whose token it carries, reading the token again: the
 * tools are not `registrations` of the transport (see below), whose request services only MCP middleware meets.
 */
const asGrantCaller = McpServer.middleware<{ provides: McpCaller }>()(
  Effect.gen(function* () {
    const grants = yield* Grants;

    return (effect, { headers }) =>
      Effect.flatMap(callerOf(grants, headers.authorization), (caller) =>
        Option.isSome(caller)
          ? Effect.provideService(effect, McpCaller, caller.value)
          : // The token passed `accessToken` an instant ago: only a Grant that ended since leads here.
            Effect.fail(
              new McpSchema.InvalidRequest({ message: "The access token opens no Grant." }),
            ),
      );
  }),
);

export const McpEndpoint = Layer.unwrap(
  Effect.gen(function* () {
    const publicOrigin = yield* ServerConfig.publicOrigin;

    const transport = McpServer.layerHttp({
      name: brand.name,
      version: "1.0.0",
      instructions,
      path: MCP_PATH,
      protocols: [McpProtocol.v2026_07_28],
      // The middleware answers another origin first; the server, which refuses any origin it is not
      // told of, must still let the public one through.
      allowedOrigins: [publicOrigin],
    }).pipe(Layer.provide(accessToken(publicOrigin).layer));

    // The tools are built outside the scope of `accessToken`, which would otherwise also wrap the routes of
    // the `Api` they call in process, and challenge each call for a token it does not carry.
    return ContractTools.pipe(Layer.provide(asGrantCaller.layer), Layer.provideMerge(transport));
  }),
);
