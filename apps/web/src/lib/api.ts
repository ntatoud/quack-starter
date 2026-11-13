import { Api } from "@quack/contracts/api";
import { makeHttpApiProcedures } from "@quack/effect-query/http-api-procedures";
import { Context, Effect, Layer, ManagedRuntime } from "effect";
import { FetchHttpClient } from "effect/http";
import { HttpApiClient } from "effect/http-api";

class ApiClient extends Context.Service<ApiClient, HttpApiClient.ForApi<typeof Api>>()(
  "@quack/web/ApiClient",
) {
  // No base URL: the browser resolves the contract's /api paths on the page's origin, and the web app relays them.
  static readonly layer = Layer.effect(ApiClient, HttpApiClient.make(Api)).pipe(
    Layer.provide(FetchHttpClient.layer),
  );
}

export const api = makeHttpApiProcedures(Api, {
  client: Effect.service(ApiClient),
  runtime: ManagedRuntime.make(ApiClient.layer),
});
