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
  static readonly layer = Layer.effect(
    TestClient,
    HttpApiTest.groups(TestApi, ["items", "system"]),
  ).pipe(Layer.provide([...Handlers, HttpServer.layerServices]));
}

const runtime = ManagedRuntime.make(TestClient.layer);
const api = makeHttpApiProcedures(TestApi, { client: Effect.service(TestClient), runtime });

const emptyRuntime = ManagedRuntime.make(Layer.empty);

/** Procedures whose client is the given Effect, for what the API cannot make it do: die, or hang. */
const withClient = (client: Effect.Effect<never>) =>
  makeHttpApiProcedures(TestApi, { client, runtime: emptyRuntime });

afterAll(() => Promise.all([runtime.dispose(), emptyRuntime.dispose()]));

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

  it("builds keys that narrow from the procedure to one input", () => {
    const input = { params: { id: "1" } };

    expect(api.items.get.key()).toEqual([["items", "get"]]);
    expect(api.items.get.key({ type: "query" })).toEqual([["items", "get"], { type: "query" }]);
    expect(api.items.get.queryOptions({ input }).queryKey).toEqual([
      ["items", "get"],
      { type: "query", input },
    ]);
    expect(api.items.create.mutationOptions().mutationKey).toEqual([
      ["items", "create"],
      { type: "mutation" },
    ]);
  });

  it("keeps the caller's overrides", () => {
    expect(api.items.list.queryOptions({ staleTime: 1000 }).staleTime).toBe(1000);
  });

  it("puts the endpoints of a top-level group at the root", async () => {
    expect(api.version.key()).toEqual([["version"]]);
    await expect(new QueryClient().fetchQuery(api.version.queryOptions())).resolves.toBe("1.0.0");
  });

  it("rejects with the endpoint's typed error", async () => {
    const options = api.items.get.queryOptions({ input: { params: { id: "missing" } } });

    await expect(new QueryClient().fetchQuery(options)).rejects.toEqual(
      new ItemNotFound({ id: "missing" }),
    );
  });

  it("rejects with the defect when the Effect dies", async () => {
    const defect = new Error("unexpected");

    await expect(
      new QueryClient().fetchQuery(withClient(Effect.die(defect)).items.list.queryOptions()),
    ).rejects.toBe(defect);
  });

  it("interrupts the Effect when the query is cancelled", async () => {
    let interrupted = false;

    const hangs = withClient(
      Effect.never.pipe(
        Effect.onInterrupt(() =>
          Effect.sync(() => {
            interrupted = true;
          }),
        ),
      ),
    );

    const queryClient = new QueryClient();
    const options = hangs.items.list.queryOptions();

    const pending = queryClient.fetchQuery(options);
    await queryClient.cancelQueries({ queryKey: options.queryKey });

    await expect(pending).rejects.toBeDefined();
    await expect.poll(() => interrupted).toBe(true);
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
