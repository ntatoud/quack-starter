import { Api } from "@quack/contracts/api";
import { User } from "@quack/contracts/identity/user";
import { Effect, Schema } from "effect";
import { Cookies, FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { HttpApiClient } from "effect/http-api";

const encodeUser = Schema.encodeSync(User);

interface FetchCurrentUserOptions {
  /** Origin of the API, such as `http://localhost:3001`. */
  readonly apiUrl: URL;
  /** The `Cookie` header of the request being handled, when it has one. */
  readonly cookie: string | undefined;
}

/**
 * Asks the API who the Current User is, on behalf of the request being handled: the web server has no cookie
 * of its own, so it sends the visitor's. Answers `null` when the API says `Unauthenticated`.
 *
 * `setCookie` is what the API wants the browser to store: a Session it extended, or one it cleared.
 * The caller sends it on, or the browser never sees it.
 *
 * The User is encoded, since it crosses from the web server to the browser.
 */
export const fetchCurrentUser = async ({ apiUrl, cookie }: FetchCurrentUserOptions) => {
  const setCookie: Array<string> = [];

  const user = await Effect.gen(function* () {
    const client = yield* HttpApiClient.make(Api, {
      baseUrl: apiUrl,
      transformClient: (httpClient) =>
        httpClient.pipe(
          HttpClient.mapRequest((request) =>
            cookie === undefined ? request : HttpClientRequest.setHeader(request, "cookie", cookie),
          ),
          HttpClient.tap((response) =>
            Effect.sync(() => {
              setCookie.push(...Cookies.toSetCookieHeaders(response.cookies));
            }),
          ),
        ),
    });
    return encodeUser(yield* client.identity.me());
  }).pipe(
    Effect.catchTag("Unauthenticated", () => Effect.succeed(null)),
    Effect.provide(FetchHttpClient.layer),
    Effect.runPromise,
  );

  return { user, setCookie };
};
