import { Api } from "@quack/contracts/api";
import { Authentication } from "@quack/contracts/identity/authentication";
import { Context, Effect, Layer, Schema, Scope } from "effect";
import { McpServer, Toolkit } from "effect/ai";
import { HttpClient, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { HttpApiBuilder, HttpApiClient, HttpApiMiddleware } from "effect/http-api";

import { accessTo, McpCaller } from "#/modules/identity/index.ts";
import {
  type DerivedTool,
  endpointsByTool,
  type EndpointRequest,
  type ToolInput,
} from "#/modules/mcp/lib/derive-tools.ts";

type Endpoint = (request: EndpointRequest) => Effect.Effect<Schema.Json, unknown>;

/** The client of the `Api`, indexed by the names its derived tools carry. */
interface ClientEndpoints {
  readonly [group: string]: { readonly [endpoint: string]: Endpoint };
}

/**
 * A client of the `Api` that calls its handlers in this fiber, with no network between: the McpCaller
 * of the MCP request reaches `Authentication` through the context.
 */
const inProcessClient = Effect.gen(function* () {
  // A router of its own: `HttpRouter.toHttpEffect` would reuse the server's, built already, and declare
  // every route of the `Api` twice.
  const router = yield* Layer.build(
    HttpApiBuilder.layer(Api).pipe(Layer.provideMerge(Layer.fresh(HttpRouter.layer))),
  );

  const handle = Context.get(router, HttpRouter.HttpRouter).asHttpEffect();
  const scope = yield* Effect.scope;

  const httpClient = HttpClient.make((request) => {
    const requestScope = Scope.forkUnsafe(scope);

    return handle.pipe(
      Effect.map((response) => HttpServerResponse.toClientResponse(response, { request })),
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromClientRequest(request),
      ),
      Effect.provideService(Scope.Scope, requestScope),
      Effect.orDie,
      Effect.onExit((exit) => Scope.close(requestScope, exit)),
    );
  });

  const client = yield* HttpApiClient.makeWith(Api, {
    httpClient,
    baseUrl: "http://in-process",
  }).pipe(
    // The caller travels in the context, so the request carries no credential.
    Effect.provide(
      HttpApiMiddleware.layerClient(Authentication, ({ next, request }) => next(request)),
    ),
  );

  // The client is typed by the `Api`, which a toolkit built at runtime cannot index by name.
  const generic: object = client;

  return generic as ClientEndpoints;
});

const callEndpoint = (
  client: Effect.Success<typeof inProcessClient>,
  { group, endpoint, errors, toRequest, toResult }: DerivedTool,
) => {
  const call = client[group.identifier]![endpoint.identifier]!;
  const isDeclared = Schema.is(Schema.Union(errors));

  return (args: ToolInput) =>
    call(toRequest(args)).pipe(
      Effect.map(toResult),
      // Every error an endpoint declares, its middleware's included, is a `Schema.TaggedError`.
      Effect.catch((error) => {
        if (!isDeclared(error)) return Effect.die(error);
        const { _tag, message } = error as { readonly _tag: string; readonly message: string };

        return Effect.fail({ _tag, message });
      }),
    );
};

/**
 * Lists a tool the caller's Grant opens, or could open once the User approves more: an AI Client calls only
 * the tools it sees, and the 403 of a call it lacks the Permission for is what leads it to step up.
 */
const visibleToCaller = (tools: ReadonlyArray<DerivedTool>) => {
  const endpoints = endpointsByTool(tools);

  return McpServer.visibility(({ target }) =>
    Effect.gen(function* () {
      const endpoint = endpoints.get(target);

      if (endpoint === undefined) return false;
      const { permissions } = yield* McpCaller;

      return (yield* accessTo(endpoint, permissions))._tag !== "Refused";
    }),
  );
};

// The toolkit is built at runtime, so its types say nothing: the services it needs are those of the client.
const register = (
  tools: ReadonlyArray<DerivedTool>,
): Effect.Effect<void, never, McpServer.McpServer | Effect.Services<typeof inProcessClient>> =>
  Effect.gen(function* () {
    const client = yield* inProcessClient;
    const toolkit = Toolkit.make(...tools.map(({ tool }) => tool));

    const handlers = Object.fromEntries(
      tools.map((tool) => [tool.tool.name, callEndpoint(client, tool)]),
    );

    yield* McpServer.registerToolkit(toolkit).pipe(
      Effect.provide(toolkit.toLayer(handlers as never)),
    );
  });

/** Each tool calls its endpoint as the McpCaller of the MCP request: a middleware outside must provide it. */
export const contractTools = (tools: ReadonlyArray<DerivedTool>) =>
  Layer.effectDiscard(register(tools)).pipe(Layer.provide(visibleToCaller(tools).layer));
