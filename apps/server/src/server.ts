import * as NodeHttp from "node:http";

import { NodeHttpServer } from "@effect/platform-node";
import { Api, API_PREFIX } from "@quack/contracts/api";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";
import { HttpApiBuilder, HttpApiScalar } from "effect/http-api";

import { ServerConfig } from "#/config.ts";
import { McpEndpoint } from "#/mcp/mcp-endpoint.ts";
import {
  IdentityModule,
  OAuthMetadataRoutes,
  AiClientsModule,
  TokenEndpointHeaders,
} from "#/modules/identity/index.ts";
import { SystemModule } from "#/modules/system/index.ts";
import { TodosModule } from "#/modules/todos/index.ts";

// One instance of the handlers serves both the HTTP API and the tools, which call it in process.
const ApiHandlers = Layer.mergeAll(SystemModule, TodosModule, AiClientsModule).pipe(
  Layer.provideMerge(IdentityModule),
);

const ApiRoutes = HttpApiBuilder.layer(Api, { openapiPath: `${API_PREFIX}/openapi.json` }).pipe(
  Layer.provide(ApiHandlers),
);

const McpRoutes = McpEndpoint.pipe(Layer.provide(ApiHandlers));

const DocsRoute = HttpApiScalar.layer(Api, { path: `${API_PREFIX}/docs` });

export const Routes = Layer.mergeAll(
  ApiRoutes,
  DocsRoute,
  OAuthMetadataRoutes,
  TokenEndpointHeaders,
  McpRoutes,
);

const Server = Layer.unwrap(
  Effect.gen(function* () {
    const port = yield* ServerConfig.port;

    return NodeHttpServer.layer(NodeHttp.createServer, { port });
  }),
);

export const ServerLayer = HttpRouter.serve(Routes).pipe(Layer.provide(Server));
