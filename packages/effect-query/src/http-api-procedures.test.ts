import { QueryClient } from "@tanstack/react-query";
import { Context, Effect, Layer, ManagedRuntime, Schema } from "effect";
import { HttpServer } from "effect/http";
import {
  HttpApi,
  HttpApiBuilder,
  type HttpApiClient,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  HttpApiTest,
} from "effect/http-api";
import { afterAll, describe, expect, it } from "vite-plus/test";

import { makeHttpApiProcedures } from "#/http-api-procedures.ts";

class ItemNotFound extends Schema.TaggedError<ItemNotFound, { readonly brand: unique symbol }>()(
  "ItemNotFound",
  { id: Schema.String },
) {}

const Item = Schema.Struct({ id: Schema.String, name: Schema.String });

class ItemsApi extends HttpApiGroup.make("items")
  .add(
    HttpApiEndpoint.get("list", "/", { success: Schema.Array(Item) }),
    HttpApiEndpoint.get("get", "/:id", {
      params: { id: Schema.String },
      success: Item,
      error: ItemNotFound.pipe(HttpApiSchema.status(404)),
    }),
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct({ name: Schema.String }),
      success: Item,
    }),
  )
  .prefix("/items") {}

class SystemApi extends HttpApiGroup.make("system", { topLevel: true }).add(
  HttpApiEndpoint.get("version", "/version", { success: Schema.String }),
) {}

class TestApi extends HttpApi.make("test").add(ItemsApi).add(SystemApi) {}

const items = [{ id: "1", name: "First" }];

const Handlers = [
  HttpApiBuilder.group(TestApi, "items", (handlers) =>
    handlers.handleAll({
      list: () => Effect.succeed(items),
      get: ({ params }) =>
        params.id === "1" ? Effect.succeed(items[0]!) : Effect.fail(new ItemNotFound(params)),
      create: ({ payload }) => Effect.succeed({ id: "2", name: payload.name }),
    }),
  ),
  HttpApiBuilder.group(TestApi, "system", (handlers) =>
    handlers.handleAll({ version: () => Effect.succeed("1.0.0") }),
  ),
] as const;

class TestClient extends Context.Service<TestClient, HttpApiClient.ForApi<typeof TestApi>>()(
  "TestClient",
) {
  // The handlers answer in memory: no socket, no port.
  static readonly layer = Layer.effect(
    TestClient,
    HttpApiTest.groups(TestApi, ["items", "system"]),
  ).pipe(Layer.provide([...Handlers, HttpServer.layerServices]));
}

const runtime = ManagedRuntime.make(TestClient.layer);
const api = makeHttpApiProcedures(TestApi, { client: Effect.service(TestClient), runtime });

afterAll(() => runtime.dispose());

describe("makeHttpApiProcedures", () => {
  it("runs queries and mutations through the typed client", async () => {
    const queryClient = new QueryClient();

    expect(await queryClient.fetchQuery(api.items.list.queryOptions())).toEqual(items);
    expect(
      await queryClient.fetchQuery(api.items.get.queryOptions({ input: { params: { id: "1" } } })),
    ).toEqual(items[0]);

    const create = api.items.create.mutationOptions().mutationFn;
    expect(await create?.({ payload: { name: "Second" } }, undefined as never)).toEqual({
      id: "2",
      name: "Second",
    });
  });

  it("puts the endpoints of a top-level group at the root", async () => {
    expect(api.version.key()).toEqual([["version"]]);
    await expect(new QueryClient().fetchQuery(api.version.queryOptions())).resolves.toBe("1.0.0");
  });

  it("rejects with the endpoint's typed error", async () => {
    const options = api.items.get.queryOptions({ input: { params: { id: "missing" } } });

    await expect(new QueryClient().fetchQuery(options)).rejects.toMatchObject({
      _tag: "ItemNotFound",
      id: "missing",
    });
  });

  it("invalidates a whole group, or one procedure", async () => {
    const queryClient = new QueryClient();
    const list = api.items.list.queryOptions();
    const one = api.items.get.queryOptions({ input: { params: { id: "1" } } });
    const version = api.version.queryOptions();
    await queryClient.fetchQuery(list);
    await queryClient.fetchQuery(one);
    await queryClient.fetchQuery(version);
    const stale = () =>
      [list.queryKey, one.queryKey, version.queryKey].map(
        (queryKey) => queryClient.getQueryState<unknown>(queryKey)?.isInvalidated,
      );

    await queryClient.invalidateQueries({ queryKey: api.items.get.key(), refetchType: "none" });
    expect(stale()).toEqual([false, true, false]);

    await queryClient.invalidateQueries({ queryKey: api.items.key(), refetchType: "none" });
    expect(stale()).toEqual([true, true, false]);
  });

  it("refuses an endpoint that would shadow the group key", () => {
    class Shadowing extends HttpApi.make("shadowing").add(
      HttpApiGroup.make("items").add(HttpApiEndpoint.get("key", "/key")),
    ) {}

    expect(() =>
      makeHttpApiProcedures(Shadowing, {
        client: Effect.never,
        runtime: ManagedRuntime.make(Layer.empty),
      }),
    ).toThrow('Endpoint "items.key" collides with another key.');
  });
});
