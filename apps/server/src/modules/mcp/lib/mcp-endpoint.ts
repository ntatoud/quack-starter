import { brand } from "@quack/brand/brand";
import { Api, MCP_PATH } from "@quack/contracts/api";
import { Effect, Layer, Option, Redacted } from "effect";
import { McpProtocol, McpSchema, McpServer } from "effect/ai";
import { type Headers, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import type { HttpApiEndpoint } from "effect/http-api";

import { ServerConfig } from "#/config.ts";
import { accessTo, Grants, McpCaller } from "#/modules/identity/index.ts";
import { contractTools } from "#/modules/mcp/lib/contract-tools.ts";
import { deriveTools, endpointsByTool } from "#/modules/mcp/lib/derive-tools.ts";

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
 * What a `tools/call` must ask the User for before the caller may make it, read from its `Mcp-Name` header
 * (MCP 2026-07-28). A tool no endpoint stands for is left to the MCP server to refuse.
 */
const stepUpOf = (
  endpoints: ReadonlyMap<string, HttpApiEndpoint.Top>,
  headers: Headers.Headers,
  { permissions }: McpCaller["Service"],
) => {
  const name = headers["mcp-name"];

  const endpoint =
    headers["mcp-method"] === "tools/call" && name !== undefined
      ? endpoints.get(McpServer.decodeNameHeader(name) ?? "")
      : undefined;

  return endpoint === undefined
    ? Effect.succeedNone
    : Effect.map(accessTo(endpoint, permissions), (access) =>
        access._tag === "StepUp" ? Option.some(access.scope) : Option.none(),
      );
};

/**
 * Lets through to the MCP server only a request from no origin or the public one, carrying the access
 * token of an active Grant that holds the Permission of the tool it calls. Anything else gets its answer
 * over HTTP, before any JSON-RPC.
 */
const accessToken = (publicOrigin: string, endpoints: ReadonlyMap<string, HttpApiEndpoint.Top>) => {
  const resourceMetadata = `resource_metadata="${publicOrigin}/.well-known/oauth-protected-resource${MCP_PATH}"`;

  const challenge = (status: 401 | 403, ...params: ReadonlyArray<string>) =>
    HttpServerResponse.empty({
      status,
      headers: { "www-authenticate": `Bearer ${[...params, resourceMetadata].join(", ")}` },
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

          // RFC 6750 s3: a request with no token gets no error code; one whose token opens nothing, invalid_token.
          if (Option.isNone(caller)) {
            return headers.authorization === undefined
              ? challenge(401)
              : challenge(401, 'error="invalid_token"');
          }

          const scope = yield* stepUpOf(endpoints, headers, caller.value);

          return Option.isSome(scope)
            ? challenge(403, 'error="insufficient_scope"', `scope="${scope.value.join(" ")}"`)
            : yield* toMcpServer;
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
    const tools = yield* deriveTools(Api);
    const endpoints = endpointsByTool(tools);

    const transport = McpServer.layerHttp({
      name: brand.name,
      version: "1.0.0",
      instructions,
      path: MCP_PATH,
      protocols: [McpProtocol.v2026_07_28],
      // The middleware answers another origin first; the server, which refuses any origin it is not
      // told of, must still let the public one through.
      allowedOrigins: [publicOrigin],
    }).pipe(Layer.provide(accessToken(publicOrigin, endpoints).layer));

    // The tools are built outside the scope of `accessToken`, which would otherwise also wrap the routes of
    // the `Api` they call in process, and challenge each call for a token it does not carry.
    return contractTools(tools).pipe(
      Layer.provide(asGrantCaller.layer),
      Layer.provideMerge(transport),
    );
  }),
);
