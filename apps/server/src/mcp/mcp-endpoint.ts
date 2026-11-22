import { brand } from "@quack/brand/brand";
import { MCP_PATH } from "@quack/contracts/api";
import { Effect, Layer, Option } from "effect";
import { McpProtocol, McpServer } from "effect/ai";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import { ServerConfig } from "#/config.ts";
import { ContractTools } from "#/mcp/contract-tools.ts";
import { McpCaller } from "#/modules/identity/index.ts";

const instructions = `${brand.name} manages the Todos of the User who connected you. Call todos_list first.`;

const callerOf = (
  _authorization: string | undefined,
): Effect.Effect<Option.Option<McpCaller["Service"]>> =>
  // No AI Client can hold an access token until Quack issues Grants: every request is challenged.
  Effect.succeedNone;

/**
 * Lets through to the MCP server only a request from no origin or the public one, carrying the access
 * token of a Grant, as the McpCaller of that Grant.
 */
const accessToken = (publicOrigin: string) => {
  const challenge = HttpServerResponse.empty({
    status: 401,
    headers: {
      "www-authenticate": `Bearer resource_metadata="${publicOrigin}/.well-known/oauth-protected-resource${MCP_PATH}"`,
    },
  });

  return HttpRouter.middleware<{ provides: McpCaller }>()((toMcpServer) =>
    Effect.gen(function* () {
      const { headers } = yield* HttpServerRequest.HttpServerRequest;

      // A page of another origin is refused before anything else: a browser sends its Origin (DNS rebinding).
      if (headers.origin !== undefined && headers.origin !== publicOrigin) {
        return HttpServerResponse.empty({ status: 403 });
      }

      const caller = yield* callerOf(headers.authorization);

      return Option.isSome(caller)
        ? yield* Effect.provideService(toMcpServer, McpCaller, caller.value)
        : challenge;
    }),
  );
};

export const McpEndpoint = Layer.unwrap(
  Effect.gen(function* () {
    const publicOrigin = yield* ServerConfig.publicOrigin;

    return McpServer.layerHttp({
      name: brand.name,
      version: "1.0.0",
      instructions,
      path: MCP_PATH,
      protocols: [McpProtocol.v2026_07_28],
      // The middleware answers another origin first; the server, which refuses any origin it is not
      // told of, must still let the public one through.
      allowedOrigins: [publicOrigin],
      registrations: ContractTools,
    }).pipe(Layer.provide(accessToken(publicOrigin).layer));
  }),
);
