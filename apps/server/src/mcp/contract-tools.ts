import { Api } from "@quack/contracts/api";
import { Authentication } from "@quack/contracts/identity/authentication";
import { Context, Effect, Layer, Schema, Scope } from "effect";
import { McpServer, Toolkit } from "effect/ai";
import { HttpClient, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { HttpApiBuilder, HttpApiClient, HttpApiMiddleware } from "effect/http-api";

import { type DerivedTool, deriveTools } from "#/mcp/derive-tools.ts";
import { authorize, McpCaller } from "#/modules/identity/index.ts";

type Endpoint = (request: object) => Effect.Effect<unknown, unknown>;

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
  return client as unknown as Readonly<Record<string, Readonly<Record<string, Endpoint>>>>;
});

const pick = (input: Readonly<Record<string, unknown>>, names: ReadonlyArray<string>) =>
  Object.fromEntries(
    names.flatMap((name) => (input[name] === undefined ? [] : [[name, input[name]]])),
  );

const callEndpoint = (
  client: Effect.Success<typeof inProcessClient>,
  { group, endpoint, input, success, errors }: DerivedTool,
) => {
  const call = client[group.identifier]![endpoint.identifier]!;
  const isDeclared = Schema.is(Schema.Union(errors));

  return (args: Readonly<Record<string, unknown>>) =>
    call({
      ...(endpoint.params === undefined ? {} : { params: pick(args, input.params) }),
      ...(endpoint.query === undefined ? {} : { query: pick(args, input.query) }),
      ...(endpoint.payload.size === 0 ? {} : { payload: pick(args, input.payload) }),
    }).pipe(
      Effect.map((result) => {
        switch (success) {
          case "items":
            return { items: result };
          case "none":
            return undefined;
          case "object":
            return result;
        }
      }),
      // Every error an endpoint declares, its middleware's included, is a `Schema.TaggedError`.
      Effect.catch((error) => {
        if (!isDeclared(error)) return Effect.die(error);
        const { _tag, message } = error as { readonly _tag: string; readonly message: string };
        return Effect.fail({ _tag, message });
      }),
    );
};

/** Hides a tool whose endpoint needs a Permission the caller's Grant lacks, by the same check as the `Api`. */
const visibleToCaller = (tools: ReadonlyArray<DerivedTool>) => {
  const endpoints = new Map(tools.map(({ tool, endpoint }) => [tool.name, endpoint]));
  return McpServer.visibility(({ target }) =>
    Effect.gen(function* () {
      const endpoint = endpoints.get(target);
      if (endpoint === undefined) return false;
      const { permissions } = yield* McpCaller;
      return yield* authorize(endpoint, (permission) => permissions.has(permission)).pipe(
        Effect.as(true),
        Effect.catch(() => Effect.succeed(false)),
      );
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
  }) as never;

/**
 * The tools derived from the `Api`, each calling its endpoint in process as the McpCaller of the MCP
 * request, which a middleware outside must provide.
 */
export const ContractTools = Layer.unwrap(
  Effect.map(deriveTools(Api), (tools) =>
    Layer.effectDiscard(register(tools)).pipe(Layer.provide(visibleToCaller(tools).layer)),
  ),
);
