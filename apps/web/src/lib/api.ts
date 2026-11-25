import { Api } from "@quack/contracts/api";
import { makeHttpApiProcedures } from "@quack/effect-query/http-api-procedures";
import { Context, Effect, Layer, ManagedRuntime } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { HttpApiClient } from "effect/http-api";

class ApiClient extends Context.Service<ApiClient, HttpApiClient.ForApi<typeof Api>>()(
  "@quack/web/ApiClient",
) {
  // No base URL: the browser resolves the contract's /api paths on the page's origin, and the web app relays them.
  // The server's auth library refuses a sign-up, sign-in, or sign-out without its CSRF header: another site
  // cannot send a custom header without a CORS preflight, which Quack never answers.
  static readonly layer = Layer.effect(
    ApiClient,
    HttpApiClient.make(Api, {
      transformClient: HttpClient.mapRequest(
        HttpClientRequest.setHeader("x-effect-auth-csrf", "1"),
      ),
    }),
  ).pipe(Layer.provide(FetchHttpClient.layer));
}

export const api = makeHttpApiProcedures(Api, {
  client: Effect.service(ApiClient),
  runtime: ManagedRuntime.make(ApiClient.layer),
});
