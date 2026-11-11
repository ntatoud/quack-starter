# Effect v4 security middleware: what `effect/http-api` provides

Ticket: #19 (map #18). Facts only; the decision that consumes this is #24.

Version inspected: `effect` 4.1.4 (`apps/server/node_modules/effect`). Everything under `http-api` is marked `@stability unstable`.

Sources (all under `apps/server/node_modules/effect/`):

- `ai-docs/src/51_http-server/fixtures/api/Authorization.ts`, `fixtures/api/Users.ts`, `fixtures/server/Authorization.ts`
- `ai-docs/src/51_http-server/10_basics.ts`, `20_testing.ts`
- `src/http-api/HttpApiMiddleware.ts`, `HttpApiSecurity.ts`, `HttpApiBuilder.ts`, `HttpApiClient.ts`, `HttpApiTest.ts`, `HttpApiGroup.ts`, `HttpApi.ts`, `HttpApiEndpoint.ts`, `OpenApi.ts`
- `src/http/Cookies.ts`, `HttpMiddleware.ts` (cors), `FetchHttpClient.ts`, `HttpClient.ts`

## 1. The pieces

### `HttpApiMiddleware.Service` (declaration)

`HttpApiMiddleware.Service<Self, { provides, requires, clientError }>()(id, { error, security, requiredForClient })` returns a `Context.Service` class (`HttpApiMiddleware.ts` lines 344-402).

- `provides`: services the middleware injects into everything downstream (later middleware and the endpoint handler). Type-level only.
- `requires`: services the middleware implementation needs from other middleware.
- `error`: one error schema or an array. These schemas are added to the error schemas of every endpoint the middleware is attached to (`getErrorSchemas` in `HttpApiEndpoint.ts` line 416), so they appear in the OpenAPI document and in the derived client's error type.
- `security`: a non-empty record `{ name: HttpApiSecurity }`. An empty object throws at declaration time.
- `requiredForClient` (default `false`): when `true`, the client must be given an implementation of the middleware (see section 5).

The declaration lives in the contract; the fixture states "Api definitions should always be separate from the server implementation" (`10_basics.ts`).

### `HttpApiSecurity` (credential schemes)

`HttpApiSecurity.ts` defines three kinds:

| Constructor                                               | Credential type given to the middleware | Where it is read from                                                                              |
| --------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `HttpApiSecurity.bearer` (= `http({ scheme: "Bearer" })`) | `Redacted<string>`                      | `Authorization` header, scheme case-insensitive                                                    |
| `HttpApiSecurity.http({ scheme })`                        | `Redacted<string>`                      | `Authorization` header with that scheme                                                            |
| `HttpApiSecurity.apiKey({ key, in })`                     | `Redacted<string>`                      | `in` is `"header"` (default), `"query"`, or `"cookie"`; `key` is the header, query, or cookie name |
| `HttpApiSecurity.basic`                                   | `{ username, password: Redacted }`      | `Authorization: Basic base64(user:pass)`                                                           |

So a cookie scheme is `HttpApiSecurity.apiKey({ key: "<cookie name>", in: "cookie" })`. There is no dedicated "cookie session" scheme. `securityDecode` (`HttpApiBuilder.ts` line 568) does the extraction. A missing or malformed credential does not fail the request: it yields `Redacted.make("")` (empty username and password for basic). The middleware implementation is responsible for rejecting the empty value.

`annotate` and `annotateMerge` on a security value attach OpenAPI metadata (`Description`, and `Format` for the bearer format).

### Server implementation

The implementation is a Layer for the middleware service. Its shape depends on whether `security` was declared (`ServiceClass`, lines 295-329):

- Without `security`: one function `(httpEffect, { endpoint, group }) => Effect<HttpServerResponse, E, Requires | HttpRouter.Provided>`.
- With `security`: an object with one function per security key, `(httpEffect, { credential, endpoint, group }) => Effect<...>`.

`httpEffect` is the rest of the pipeline (inner middleware plus handler). The middleware provides a service by wrapping it: `Effect.provideService(httpEffect, CurrentUser, user)`. Failing with the declared error schema's type short-circuits the request. The implementation Layer can itself depend on services (database, session store), as a comment in the fixture notes.

Fixture implementation (`fixtures/server/Authorization.ts`):

```ts
export const AuthorizationLayer = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    return Authorization.of({
      bearer: Effect.fn(function* (httpEffect, { credential }) {
        if (Redacted.value(credential) !== "dev-token") {
          return yield* new Unauthorized({ message: "Missing or invalid bearer token" });
        }
        return yield* Effect.provideService(httpEffect, CurrentUser, devUser);
      }),
    });
  }),
);
```

### The `CurrentUser` service

It is an ordinary `Context.Service` declared next to the middleware in the contract fixture (`Authorization.ts`): `class CurrentUser extends Context.Service<CurrentUser, User>()("acme/HttpApi/Authorization/CurrentUser") {}`. It is named in `provides: CurrentUser`. A handler reads it with `yield* CurrentUser`. Handlers of guarded endpoints do not list `CurrentUser` in their requirements (the middleware's `provides` is subtracted via `ApplyServices`, lines 208-215). The fixture's `User` is a domain class imported by the contract; in this repo the contracts package may import only `effect`, so the value type of such a service would have to be a contract schema.

## 2. Declaring versus implementing

- Declaration (contract): the `HttpApiMiddleware.Service` class, its `error`, `security`, `provides` types, and `requiredForClient`; also where it is attached.
- Implementation (server): a Layer `Layer.effect(Authorization, ...)` provided where the API routes are built.
- Attachment, three granularities, all via `.middleware(Service)`:
  - Endpoint: `HttpApiEndpoint....middleware(M)` (`HttpApiEndpoint.ts` line 342).
  - Group: `HttpApiGroup....middleware(M)`; applies to every endpoint currently in the group.
  - Whole API: `HttpApi.make(...).middleware(M)`; applies to every endpoint of every group currently added.
- Gotcha stated in the doc comments of `HttpApiGroup.ts` and `HttpApi.ts`: endpoints or groups added after the `.middleware` call do not get the middleware. Order matters. The fixture calls `.add(...)` first, then `.middleware(Authorization)`, then `.prefix(...)`.
- Public endpoints are expressed by not attaching the middleware (for example the `system` health group in the fixture API). No per-endpoint opt-out of a group-level middleware was found.
- Multiple middlewares: `endpoint.middlewares` is an ordered `Set`. On the server, `applyMiddleware` (`HttpApiBuilder.ts` line 1088) wraps the handler in set order, so the last added middleware is the outermost. A middleware may declare `requires` for another middleware's `provides`.
- Several security schemes in one middleware: `makeSecurityMiddleware` (line 1111) tries each scheme in declaration order, decoding the credential then calling that scheme's function. A failure of the middleware moves on to the next scheme; an error raised by the endpoint handler itself is wrapped in a `HandlerError` and is not retried. If all schemes fail, the last failure is returned.
- Error status: the fixture sets it on the error class through the third argument `{ httpApiStatus: 401 }` of `Schema.TaggedError`. `HttpApiError` also ships built-in `Unauthorized` (401) and `Forbidden` (403) (`HttpApiError.ts` lines 82, 114) plus `...NoContent` variants. This repo's `AGENTS.md` instead sets status with `HttpApiSchema.status(n)` piped onto the error in the `*Api.ts`; `HttpApiSchema.status` stores the same `httpApiStatus` annotation (`HttpApiSchema.ts` lines 129-159).
- Because middleware `error` schemas are merged into each endpoint's errors, a middleware declaring `Unauthorized` adds `Unauthorized` to the typed client error of every guarded endpoint.

## 3. Cookies

- Reading: `apiKey({ key, in: "cookie" })` decodes via `Request.schemaCookies`; the value arrives as `Redacted<string>` (empty string when absent).
- Writing: `HttpApiBuilder.securitySetCookie(security: ApiKey, value: string | Redacted, options?)` (`HttpApiBuilder.ts` line 635) registers a pre-response handler that sets the cookie named `security.key` on the outgoing response. Defaults: `secure: true`, `httpOnly: true`; `options` spreads over them. It requires `HttpServerRequest` and is meant to be called inside a handler (for example sign-in). There is no default for `sameSite` or `maxAge`.
- Cookie options available (`Cookies.ts` lines 76-82): `maxAge`, `path`, `domain`, `httpOnly`, `secure`, `partitioned`, `sameSite: "lax" | "strict" | "none"`.
- Clearing: `HttpServerResponse.expireCookie` and `Cookies.expireCookie` exist; there is no `securityExpireCookie` helper.
- Browser requirements are outside `http-api`: `HttpRouter.cors` takes `credentials?: boolean` (default `false`; `HttpMiddleware.ts` line 533) and `allowedOrigins`. The current `server.ts` calls `HttpRouter.cors({ allowedOrigins: [webOrigin] })` without `credentials`. The fetch client takes defaults from the `FetchHttpClient.RequestInit` service (`FetchHttpClient.ts` line 83), where `credentials: "include"` would be supplied. The current web `api.ts` provides `FetchHttpClient.layer` with no `RequestInit`. Dev uses ports 3000 and 3001, which are different origins.
- `HttpClient.withCookiesRef` exists for clients that must keep a cookie jar (server side or tests).

## 4. OpenAPI

`OpenApi.ts` (lines 548-575, 1045-1078) emits a security scheme per middleware security entry: `http` with `scheme` (and `bearerFormat`), `http basic`, or `apiKey` with `name` and `in` (`cookie` included). Guarded endpoints get a matching `security` requirement.

## 5. Effect on the derived client (`HttpApiClient`)

- `requiredForClient: true`: `HttpApiClient.make(Api)` requires the marker `ForClient<M>` (type `HttpApiGroup.MiddlewareClient<Groups>`). Provide it with `HttpApiMiddleware.layerClient(M, ({ next, request, endpoint, group }) => next(modifiedRequest))`; the fixture adds a bearer token with `HttpClientRequest.bearerToken`. It may declare a `clientError` in `Config`.
- `requiredForClient: false` (default): no client layer is required. If no implementation is provided, the client skips that middleware (`HttpApiClient.ts` lines 445-449). A cookie session needs no client middleware when the browser attaches the cookie itself.
- Either way, the middleware's `error` schemas are decoded into the typed error channel of every guarded endpoint. The fixture test asserts `error._tag === "Unauthorized"` from `client.users.list`.
- Top-level groups (`HttpApiGroup.make("system", { topLevel: true })`) are exposed as `client.health()`.
- Not verified: how the `@quack/effect-query` procedures in this repo surface the extra error type.

## 6. Testing with `HttpApiTest`

`HttpApiTest.groups(Api, ["users"])` returns a typed client wired in memory to the handlers of the chosen groups. It builds a real `HttpRouter` and runs the real request pipeline (routing, codecs, security decode, middleware); unselected groups are stubbed to die with "Unhandled endpoint".

- The in-memory `HttpClient` builds the server request with `HttpServerRequest.fromClientRequest(request)` and applies the request-state pre-response handlers before converting to a client response. So a cookie set with `securitySetCookie` ends up as `Set-Cookie` on the response, and headers or cookies on the client request reach `securityDecode`.
- The middleware implementation Layer must be provided even when testing handlers: `20_testing.ts` says to use `Layer.provideMerge(AuthorizationLayer)` because the HTTP pipeline resolves it when the routes are built.
- With `requiredForClient: true`, the test also provides `HttpApiMiddleware.layerClient(...)` via `Effect.provide`; the fixture provides a good variant, a no-token variant, and a wrong-token variant to cover authorized and unauthorized paths.
- With `requiredForClient: false`, the test client attaches nothing by default. The fixture only demonstrates the bearer pattern; no cookie test exists among the ai-docs.
- `Layer.mergeAll(HandlersLayer, HttpServer.layerServices)` with `layer(...)` from `@effect/vitest` is the standard harness, as `TodosHandlers.test.ts` here already does for the unguarded `todos` group.

## 7. Repo today

- `packages/contracts/src/Api.ts` assembles `SystemApi` and `TodosApi` with `.add`; neither has middleware.
- `server.ts` builds `HttpApiBuilder.layer(Api, ...)` with `Layer.provide([SystemHandlers, TodosModule])`. A middleware implementation Layer would be provided in the same place or inside the module Layers.
- `TodoNotFound` is a `Schema.TaggedError` with `HttpApiSchema.status(404)` applied in `TodosApi.ts`, the convention a middleware error would follow.

## 8. What the sources do not answer

- No cookie-session example exists in the ai-docs; the cookie path is derived from `securityDecode`, `securitySetCookie`, and `Cookies` in the source.
- A middleware declared without `security` is supported by the types (default branch of `ServiceClass`); it would read the cookie via `HttpServerRequest` itself and get no OpenAPI security scheme and no automatic credential decoding.
- Per-endpoint exclusion from a group-level middleware: no API found.
- Both `Schema.TaggedError` with `httpApiStatus` (fixture) and `Schema.Error` (built-ins) appear in 4.1.4.
