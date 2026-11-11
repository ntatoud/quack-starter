import { Api } from "@quack/contracts/api";
import { makeHttpApiProcedures } from "@quack/effect-query/http-api-procedures";
import { Context, Effect, Layer, ManagedRuntime } from "effect";
import { FetchHttpClient } from "effect/http";
import { HttpApiClient } from "effect/http-api";

import { env } from "#/lib/env.ts";

class ApiClient extends Context.Service<ApiClient, HttpApiClient.ForApi<typeof Api>>()(
  "@quack/web/ApiClient",
) {
  static readonly layer = Layer.effect(
    ApiClient,
    HttpApiClient.make(Api, { baseUrl: env.VITE_API_URL }),
  ).pipe(Layer.provide(FetchHttpClient.layer));
}

/**
 * The server's `Api` as TanStack Query options: `api.todos.list.queryOptions()`,
 * `api.todos.create.mutationOptions()`, `api.todos.key()`.
 * A failed call rejects with the endpoint's typed error, so `useQuery` exposes it as `error`.
 */
export const api = makeHttpApiProcedures(Api, {
  client: Effect.service(ApiClient),
  runtime: ManagedRuntime.make(ApiClient.layer),
});
