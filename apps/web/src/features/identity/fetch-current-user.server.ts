import { Api } from "@quack/contracts/api";
import { Effect } from "effect";
import { Cookies, FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { HttpApiClient } from "effect/http-api";

export interface FetchCurrentUserOptions {
  readonly apiUrl: URL;
  readonly cookie: string | undefined;
  readonly clientIp: string | undefined;
}

/** `setCookie` is what the API wants the browser to store: the caller sends it on, or the browser never sees it. */
export const fetchCurrentUser = async ({ apiUrl, cookie, clientIp }: FetchCurrentUserOptions) => {
  const setCookie: Array<string> = [];
  const forwardedHeaders: Record<string, string> = {};

  if (cookie !== undefined) forwardedHeaders.cookie = cookie;

  if (clientIp !== undefined) forwardedHeaders["x-forwarded-for"] = clientIp;

  const user = await Effect.gen(function* () {
    const client = yield* HttpApiClient.make(Api, {
      baseUrl: apiUrl,
      transformClient: (httpClient) =>
        httpClient.pipe(
          HttpClient.mapRequest((request) =>
            HttpClientRequest.setHeaders(request, forwardedHeaders),
          ),
          HttpClient.tap((response) =>
            Effect.sync(() => {
              setCookie.push(...Cookies.toSetCookieHeaders(response.cookies));
            }),
          ),
        ),
    });

    return yield* client.identity.me();
  }).pipe(
    Effect.catchTag("Unauthenticated", () => Effect.succeed(null)),
    Effect.provide(FetchHttpClient.layer),
    Effect.runPromise,
  );

  return { user, setCookie };
};
