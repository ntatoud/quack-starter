import { Duration, Effect, Layer, Ref, type Scope } from "effect";
import { Cookies, HttpClient, HttpClientResponse, HttpRouter, HttpServer } from "effect/http";
import { type HttpApi, HttpApiBuilder, HttpApiClient, type HttpApiGroup } from "effect/http-api";

import { ServerConfig } from "#/config.ts";
import { withAppAuthRequests } from "#/modules/identity/http/app-auth-http.ts";

/**
 * A client of `api` served in the process as the server serves it, behind Yielded's request boundary, which
 * `HttpApiTest` cannot host. It acts as a browser on Quack's origin: it sends the CSRF header of Yielded and the
 * cookies of `jar`, and keeps in it those the answers set. `handlers` are those of every group of `api`, built
 * inside the boundary, which gives them the `AuthRequest` of each request; what they require comes from the
 * caller's context.
 */
export const appAuthTestClient = <
  Id extends string,
  Groups extends HttpApiGroup.Constraint,
  A extends HttpApiGroup.ToService<Id, Groups>,
  E,
  R,
>(
  api: HttpApi.HttpApi<Id, Groups>,
  handlers: Layer.Layer<A, E, R>,
  jar: Ref.Ref<Cookies.Cookies>,
) =>
  Effect.gen(function* () {
    const origin = yield* ServerConfig.publicOrigin;
    // The services `handlers` and `AppAuth` require, which the caller provides.
    // The caller's, its TestClock included: only `AppAuth` keeps the clock it was built with.
    const context = yield* Effect.context<HttpRouter.Request.Without<R>>();

    const app = Layer.unwrap(
      withAppAuthRequests(HttpApiBuilder.layer(api).pipe(Layer.provide(handlers))),
    ).pipe(Layer.provide([HttpServer.layerServices, Layer.succeedContext(context)]));

    // The caller's context provides what the types of the router cannot see as provided.
    const { handler, dispose } = HttpRouter.toWebHandler(
      app as Layer.Layer<never, unknown, HttpRouter.HttpRouter>,
    );

    yield* Effect.addFinalizer(() => Effect.promise(dispose));

    const httpClient = HttpClient.make((request, url) =>
      Effect.gen(function* () {
        const headers = new Headers(request.headers);
        headers.set("origin", origin);
        headers.set("x-effect-auth-csrf", "1");
        const cookies = yield* Ref.get(jar);

        if (!Cookies.isEmpty(cookies)) headers.set("cookie", Cookies.toCookieHeader(cookies));

        const init: RequestInit = { method: request.method, headers };

        if (request.body._tag === "Uint8Array") init.body = request.body.body;

        const response = yield* Effect.promise(() => handler(new Request(url, init)));

        const clientResponse = HttpClientResponse.fromWeb(request, response);

        yield* Ref.update(jar, (kept) =>
          Cookies.fromIterable(
            Object.values(Cookies.merge(kept, clientResponse.cookies).cookies).filter(
              (cookie) =>
                cookie.options?.maxAge === undefined ||
                Duration.isGreaterThan(
                  Duration.fromInputUnsafe(cookie.options.maxAge),
                  Duration.zero,
                ),
            ),
          ),
        );

        return clientResponse;
      }),
    );

    return yield* HttpApiClient.makeWith(api, { httpClient, baseUrl: origin });
  }) as Effect.Effect<
    HttpApiClient.Client<Groups, never, never>,
    never,
    Scope.Scope | HttpRouter.Request.Without<R> | HttpApiGroup.MiddlewareClient<Groups>
  >;
