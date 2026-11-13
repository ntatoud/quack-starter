import { Api } from "@quack/contracts/api";
import { Effect } from "effect";
import { Cookies, FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { HttpApiClient } from "effect/http-api";

interface FetchCurrentUserOptions {
  /** Origin of the API, such as `http://localhost:3001`. */
  readonly apiUrl: URL;
  /** The `Cookie` header of the request being handled, when it has one. */
  readonly cookie: string | undefined;
  /** Address of the client as the web server sees it, when it sees one. */
  readonly clientIp: string | undefined;
}

/**
 * Asks the API who the Current User is, on behalf of the request being handled: the web server has no cookie
 * of its own, so it sends the visitor's. Answers `null` when the API says `Unauthenticated`.
 *
 * `setCookie` is what the API wants the browser to store: a Session it extended, or one it cleared.
 * The caller sends it on, or the browser never sees it.
 *
 * Like the relay, it names the client in `X-Forwarded-For`, which the API trusts.
 */
export const fetchCurrentUser = async ({ apiUrl, cookie, clientIp }: FetchCurrentUserOptions) => {
  const setCookie: Array<string> = [];

  const user = await Effect.gen(function* () {
    const client = yield* HttpApiClient.make(Api, {
      baseUrl: apiUrl,
      transformClient: (httpClient) =>
        httpClient.pipe(
          HttpClient.mapRequest((request) =>
            HttpClientRequest.setHeaders(request, {
              ...(cookie === undefined ? {} : { cookie }),
              ...(clientIp === undefined ? {} : { "x-forwarded-for": clientIp }),
            }),
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
