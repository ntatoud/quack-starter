import * as NodeHttp from "node:http";

import { NodeHttpServer } from "@effect/platform-node";
import { Api, API_PREFIX } from "@quack/contracts/api";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";
import { HttpApiBuilder, HttpApiScalar } from "effect/http-api";

import { ServerConfig } from "#/config.ts";
import { IdentityModule } from "#/modules/identity/index.ts";
import { SystemHandlers } from "#/modules/system/http/system-handlers.ts";
import { TodosModule } from "#/modules/todos/index.ts";

// The contract puts every endpoint under /api; the OpenAPI document and the docs sit there too.
const ApiRoutes = HttpApiBuilder.layer(Api, { openapiPath: `${API_PREFIX}/openapi.json` }).pipe(
  Layer.provide([SystemHandlers, TodosModule]),
  Layer.provide(IdentityModule),
);

const DocsRoute = HttpApiScalar.layer(Api, { path: `${API_PREFIX}/docs` });

/**
 * Every route of the server, all under /api.
 * There is no CORS policy: the browser reaches the server through the web app's relay, on the web app's origin.
 */
export const Routes = Layer.mergeAll(ApiRoutes, DocsRoute);

const Server = Layer.unwrap(
  Effect.gen(function* () {
    const { port } = yield* ServerConfig;
    return NodeHttpServer.layer(NodeHttp.createServer, { port });
  }),
);

export const ServerLayer = HttpRouter.serve(Routes).pipe(Layer.provide(Server));
