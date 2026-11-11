import * as NodeHttp from "node:http";

import { NodeHttpServer } from "@effect/platform-node";
import { Api } from "@quack/contracts/Api";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";
import { HttpApiBuilder, HttpApiScalar } from "effect/http-api";

import { ServerConfig } from "#/config.ts";
import { SystemHandlers } from "#/modules/system/http/SystemHandlers.ts";
import { TodosModule } from "#/modules/todos/index.ts";

const ApiRoutes = HttpApiBuilder.layer(Api, { openapiPath: "/openapi.json" }).pipe(
  Layer.provide([SystemHandlers, TodosModule]),
);

const DocsRoute = HttpApiScalar.layer(Api, { path: "/docs" });

const Cors = Layer.unwrap(
  Effect.gen(function* () {
    const { webOrigin } = yield* ServerConfig;
    return HttpRouter.cors({ allowedOrigins: [webOrigin] });
  }),
);

const Server = Layer.unwrap(
  Effect.gen(function* () {
    const { port } = yield* ServerConfig;
    return NodeHttpServer.layer(NodeHttp.createServer, { port });
  }),
);

export const ServerLayer = HttpRouter.serve(
  Layer.mergeAll(ApiRoutes, DocsRoute).pipe(Layer.provide(Cors)),
).pipe(Layer.provide(Server));
