# What Effect 4.1.4 provides to serve MCP and OAuth

Resolves issue #54 (map #52). Sources: the installed `effect@4.1.4` (`apps/server/node_modules/effect/src/...`, paths below are relative to it) and its `ai-docs`. `ai-docs` has nothing on MCP or JOSE (only `71_ai` for language models), so the TSDoc of the source is the reference. Everything in `effect/ai/Mcp*` and `effect/jose` is marked `@stability unstable`.

## Summary

- Serving MCP over HTTP is covered: `McpServer.layerHttp` mounts on an existing `HttpRouter`, speaks `2026-07-28` (stateless) and older revisions, and has a per-request `McpServer.middleware` that resolves the Current User from the request headers.
- There is no derivation of `Tool`s from `HttpApi` endpoints. It is buildable with `HttpApi.reflect` plus the low-level `McpServer.addTool`; sketch below.
- OAuth is not provided. `effect/jose` gives JWT signing and verification and a JWKS service, `effect/crypto` gives SHA-256 and random bytes. Everything protocol-shaped (authorize, token, registration, metadata documents, PKCE check, `WWW-Authenticate`) is ours to write.
- The existing `Authentication` middleware can be reused for tool calls by adding a Bearer security scheme and calling the endpoint's own handler through an in-process client, so Owner rules and Permissions stay in one place.

## 1. `effect/ai/McpServer`

### Layers (`src/ai/McpServer.ts`)

| API                                                                                                                              | What it does                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layerHttp({ name, version, path, protocols, registrations, allowedOrigins, allowSessionTermination, allowSubscriptions, ... })` | Long-lived server; registers `POST` (and `405` for `GET`/`PUT`/`PATCH`/`OPTIONS`, `DELETE`) on the `HttpRouter` at `path`. Requires `HttpRouter.HttpRouter`.                                                                                   |
| `layerHttpRequestScoped(...)`                                                                                                    | Same options minus sessions/subscriptions. Each POST runs its own server in the request scope. Accepts only sessionless protocols (`v2026_07_28`); fails layer construction with `IllegalArgumentError` otherwise. Meant for serverless hosts. |
| `layer`, `layerStdio`                                                                                                            | Custom `RpcServer.Protocol` and stdio. Stdio is out of scope for the map.                                                                                                                                                                      |
| `toolkit(Toolkit)` / `registerToolkit(Toolkit)`                                                                                  | Layer / Effect registering a `Toolkit` as MCP tools. Needs the toolkit's handlers in context (`Toolkit.toLayer`).                                                                                                                              |
| `middleware`, `visibility`                                                                                                       | Per-request middleware and per-registration hiding (below).                                                                                                                                                                                    |
| `resource`, `registerResource`, `prompt`, `registerPrompt`, `skill`, `registerSkill`, `elicit`, `clientCapabilities`             | Other MCP primitives. Not needed for tools.                                                                                                                                                                                                    |

HTTP behaviour (`addMcpHttpRoutes`, lines ~2980-3050):

- `Origin` header: rejected with `403` unless it is in `allowedOrigins`; requests with no `Origin` pass. A non-browser AI Client sends none.
- `Content-Type` must be `application/json` (else `415`); `Accept` must list `application/json` and `text/event-stream` (else `406`).
- The TSDoc says it plainly: "The surrounding HTTP server remains responsible for ... installing authentication." The layer does no authentication. It never emits `401`, `WWW-Authenticate`, or `/.well-known/*` documents (grep over `src` finds `www-authenticate` only in `McpClient.ts`, which reads it and states OAuth is "not included").

### Handing request context to tools

Two layers of per-request context exist.

1. `McpRequestContext` (`McpSchema.ts:3203`): `clientId`, `protocolVersion`, `clientCapabilities`, `clientInfo`, `requestMetadata`, `inputResponses`, `requestState`. No headers, no user.
2. `McpServer.middleware` (`McpServer.ts:486`): wraps `tools/call`, `resources/read`, `prompts/get`, `completion/complete` (and list requests only when wrapping a `visibility`). The function receives `(effect, { method, target, payload, requestContext, headers, sessionId })`, so it can read `headers["authorization"]`, then `Effect.provideService(effect, CurrentUser, user)`. The TSDoc example is exactly "resolving the current user per request".
   - A tool declares what it needs with `Tool.make(name, { dependencies: [CurrentUser] })`; the handler then does `yield* CurrentUser`. The requirement is carried as an `McpRequest<"Requires", CurrentUser>` marker and is discharged by `Auth.layer` (provided to the toolkit registration) or `Auth.layerGlobal` (every request).
   - A middleware failure must be an `McpErrorBase` (a JSON-RPC error with `code`, `message`, `data`; custom codes in -32000 to -32019). It is sent as a JSON-RPC error, never as a tool result. It cannot set an HTTP status or header, so it cannot produce `401` + `WWW-Authenticate`.
   - `McpServer.visibility(check)` hides tools per request (omitted from `tools/list`, and `tools/call` fails as unregistered). This is the natural place to hide tools whose Permission the Grant lacks.
3. The transport turns the `McpRequest` markers the MCP middleware does not discharge into `HttpRouter.Request` markers, "so `HttpRouter.middleware` can provide them, for example to authenticate the request and resolve the current user" (TSDoc of `layerHttp`). So there is a second option: an `HttpRouter.middleware` (`src/http/HttpRouter.ts:1076`) that reads `Authorization`, fails with a real `401` response carrying `WWW-Authenticate`, and provides `CurrentUser`. Because it runs on the HTTP request it can answer before any JSON-RPC is parsed.

Recommended split: an `HttpRouter` middleware for the HTTP-level `401` and the challenge header, and (or instead of it) `McpServer.middleware` plus `visibility` for the per-tool Permission check, which needs `payload`/`target`.

### `McpTest` (`src/ai/McpTest.ts`)

`McpTest.makeClient(registrations, { protocols, protocolVersion?, clientInfo?, ... })` builds the server over an in-memory `RpcServer.Protocol` and returns a typed `Client` (`listTools`, `callTool`, `listResources`, `readResource`, `listPrompts`, `getPrompt`, `complete`, `ping`, `notifications` queue, `server`). Requests go through the same JSON-RPC encoding, routing, and MCP middleware as the real transports. Consequences for testing:

- It does not go through `HttpRouter`, so headers are empty (the TSDoc of `MiddlewareOptions` says `headers` are "empty on stdio, on custom transports and for in-process calls"). A test of an `Authorization`-reading middleware needs a middleware that does not depend on headers (inject the user) or a test over the assembled `Routes` with `HttpRouter.toWebHandler` and a real POST, as `apps/server/src/server.test.ts` already does for the docs.
- `McpRequest` markers that MCP middleware does not discharge stay in the requirements, so a test must supply the middleware.

## 2. Stateless `2026-07-28` versus the older revisions

Files: `src/ai/McpProtocol.ts`, `src/ai/internal/mcpProtocol/v2026_07_28.ts`, `mcpRuntime.ts`.

- Adapters: `McpProtocol.v2026_07_28` (`runtime._tag: "Stateless"`), `v2025_11_25`, `v2025_06_18`, `v2025_03_26`, `v2024_11_05` (all `"Stateful"`). Pass `protocols: [McpProtocol.v2026_07_28]` to serve only the new one, or a list to also serve older clients.
- No `initialize`, no `Mcp-Session-Id`, no server-side session. Each request carries its own metadata (protocol version, client info and capabilities in `_meta`), decoded by `profileFromRequestMetadata`. Discovery is a `server/discover` request.
- Types: `ProvidedServices<Protocols>` supplies `McpServerClient` (reverse requests, sampling, roots, elicitation) only if every configured protocol is stateful. With `v2026_07_28` in the list, handlers cannot require `McpServerClient`; they get `McpRequestContext` only. Server-to-client interaction becomes "input required" results (`McpSchema.InputRequired`, `inputRequests`/`inputResponses`/`requestState`), returned from the tool handler as a multi round trip.
- Notifications: `subscriptions/listen` replaces the standing GET stream; `layerHttp` supports it (disable with `allowSubscriptions: false`, which advertises `listChanged: false`). `layerHttpRequestScoped` has no subscriptions and `DELETE` is `405`.
- HTTP: `layerHttp` is single-endpoint Streamable HTTP, POST only for the stateless revision. Unknown modern methods return JSON-RPC method-not-found with `404`; header mismatches and unsupported versions return JSON-RPC errors with `400`. `allowSessionTermination` is moot (`DELETE` is `405`).
- Consequence for Quack: with only `v2026_07_28`, every request is independently authenticated, which matches the standing decision (every MCP call authenticated, acts as one User). `layerHttpRequestScoped` is a fit if no list-changed notifications are wanted, but `layerHttp` also works and keeps the option of older revisions.

## 3. Deriving `Tool`s from `HttpApi`: not provided, buildable

### Confirmed absence

- `src/http-api/*` and `src/http/*` do not reference `ai`, `Tool`, `Toolkit`, or MCP. `src/ai/*` references `HttpApi` once, in `AgUiServer.ts`, which goes the other way (an AG-UI run exposed as an `HttpApiEndpoint`).
- `OpenApi.fromApi` and `HttpApi.reflect` are the only generic introspection helpers, and neither feeds `Tool`.

### Building blocks that exist

- `HttpApi.reflect(api, { predicate, onGroup, onEndpoint })` (`src/http-api/HttpApi.ts:255`): visits endpoints with `group`, `endpoint`, `mergedAnnotations` (api + group + endpoint), `middleware` (the `HttpApiMiddleware` services), and `successes`/`errors` maps keyed by status. `predicate` is the opt-in filter.
- `HttpApiEndpoint` fields (`HttpApiEndpoint.ts:307`): `identifier`, `path`, `method`, `params`, `query`, `headers`, `payload` (map of encoding to schemas), `success`, `error` (sets of `Schema.Top`), `annotations`, `middlewares`.
- `Tool.make(name, { description, parameters, success, failure, failureMode, dependencies })` takes `Schema`s; `Tool.dynamic` accepts a raw JSON Schema; `Tool.Readonly`, `Destructive`, `Idempotent`, `Title`, `Meta` are annotations that `registerToolkit` maps to MCP tool annotations (`readOnlyHint` etc.).
- Custom annotations are `Context.Reference`s set with `endpoint.annotate(Key, value)` / group `annotateMerge`. `OpenApi.Exclude` (`src/http-api/OpenApi.ts:153`) is the precedent for an opt-in/out flag. A Quack `Permission` and an `McpExposed` annotation can sit the same way and arrive in `mergedAnnotations`.
- `McpServer.addTool({ tool: McpSchema.Tool, annotations, services, handle })` (service method, `McpServer.ts:~990`): the low-level registration `registerToolkit` itself uses. `tool` is a plain MCP tool (name, description, `inputSchema` and `outputSchema` JSON Schema, annotations); `handle(payload)` returns a `CallToolResult`. It needs no `Toolkit` and no per-tool types, so tools can be generated from a runtime walk of the contract.
- `Schema.toJsonSchemaDocument` (used by `registerToolkit` as `toolJsonSchema`) turns an Effect schema into the JSON Schema an MCP tool needs; `OpenApi.fromApi` output is an alternative source.
- `HttpApiClient` (`src/http-api/HttpApiClient.ts`, `makeClient` takes `predicate`/`onEndpoint`) and `HttpApiTest.groups` build a client from an `HttpApi` over any `HttpClient`, including in memory with no server.

### What a derivation would take

For each endpoint selected by `HttpApi.reflect` (opt-in annotation present, and behind `Authentication`):

1. Name: `<group>_<endpoint>` (for example `todos_list`) or `endpoint.identifier`; MCP tool names must be unique and `Tool` names are plain strings.
2. Input schema: MCP needs an object root. Merge into one `Schema.Struct`: `params` fields (path), `query` fields (`urlParams`), and `payload` (JSON encoding only; one success-able schema; a non-struct payload needs wrapping under a key). Reject collisions between the three, and skip multipart, stream, upgrade, and form payloads.
3. Output schema: the 2xx `successes` entry. `HttpApiSchema.NoContent` (as `todos.remove`) maps to no output (`CallToolResult` with empty content); a non-object success (`Schema.Array(Todo)` as `todos.list`) must be wrapped, since MCP `structuredContent` and `outputSchema` need an object root (`registerToolkit` dies on a non-object root for input; the output path decodes `ToolOutputJson`). Pick a wrapping convention such as `{ items: [...] }`.
4. Errors: the endpoint's `errors` (for example `TodoNotFound`, 404) become a `CallToolResult` with `isError: true` and the encoded error in content; `Unauthenticated`/`Forbidden` become JSON-RPC errors or tool errors per a rule.
5. Annotations: `GET` maps to `Readonly`, `DELETE` to `Destructive`, `PUT`/`DELETE` to `Idempotent`; override by annotation. Description from `OpenApi.Description` or a Quack annotation.
6. Execution: `handle(payload)` splits the object back into `params`/`query`/`payload`, then calls the endpoint through an in-process `HttpApiClient` for the same `Api` (over `HttpApiTest`-style in-memory client or `HttpRouter` web handler), forwarding the request's credential. Handlers, `Authentication`, Owner filtering, and error mapping all run unchanged (section 4). Calling the use case directly instead would bypass the contract and the middleware.
7. Per-request visibility: a `McpServer.visibility` (or middleware branch on `target`) that hides a tool when the Grant lacks the endpoint's Permission.

Cost: one module of a few hundred lines plus tests, mostly schema merging and the wrapping conventions in steps 2 and 3. Alternative if that is too much: a hand-written `Toolkit` for Todos; but the standing decision is generic derivation.

## 4. Reusing `Authentication` and `CurrentUser`

Existing code: `packages/contracts/src/identity/authentication.ts` (`Authentication`, `CurrentUser`, `sessionCookie`) and `apps/server/src/modules/identity/http/authentication-middleware.ts` (`Authentication.of({ session: ... })` calling `identity.authenticate(credential)`).

- `HttpApiMiddleware.Service` takes `security: Record<string, HttpApiSecurity>`. `HttpApiBuilder.makeSecurityMiddleware` (`src/http-api/HttpApiBuilder.ts:1112`) tries the schemes in order and the first that decodes and succeeds wins. Adding `bearer: HttpApiSecurity.bearer` (`HttpApiSecurity.ts:167`) next to `session` makes every endpoint behind `Authentication` accept a Grant's access token (the Authorization header) as well as the Session cookie. The server then implements `bearer` in `AuthenticationMiddleware`: verify the JWT (section 5), load the Grant (revocation), build `CurrentUser` with the Grant's User, and put the Grant's Permissions in a second context service next to `CurrentUser`. Existing handlers do not change.
- `CurrentUser` stays the only identity service. For MCP, a `McpServer.middleware<{ provides: CurrentUser }>` (or the `HttpRouter` middleware) must resolve the same thing from the same header. To avoid two implementations, extract the "credential to User and Permissions" step into one identity domain function used by both.
- Execution through the in-process client (section 3 step 6) forwards the incoming `Authorization` header, so tool calls get `Authentication` for free, including the Permission check once Permissions are a middleware concern. That also keeps "Session or Grant" in one checked path, as the map requires.
- The web app is unaffected: the cookie scheme remains.

## 5. Mounting `McpServer.layerHttp` on the existing server

`apps/server/src/server.ts` builds `Routes = Layer.mergeAll(ApiRoutes, DocsRoute)` and serves with `HttpRouter.serve(Routes)`. `HttpApiBuilder.layer` and `HttpApiScalar.layer` already register on the ambient `HttpRouter`, and `layerHttp` requires `HttpRouter.HttpRouter` and adds its routes the same way, so adding it to the `Layer.mergeAll` works with no new server. Points to note:

- Path: under `/api` to stay on the one public origin relayed by the web app (for example `/api/mcp`). The relay (`apps/web/src/routes/api/$.ts`, `ApiRelayHandler`) forwards method, headers, and body unchanged, so `Authorization` passes through. Check that it streams `text/event-stream` bodies and that it handles `Mcp-Protocol-Version` and friends (they are ordinary headers); a long-lived `subscriptions/listen` response is the one thing to verify there.
- `Origin`: the browser never calls it; leave `allowedOrigins` empty (Origin-bearing requests get `403`) or add the web origin only if a browser AI Client is wanted.
- OAuth discovery documents live at the origin root (`/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`), outside `/api`. The relay only forwards `/api/*`, so those need web-app routes or an extra relay prefix. MCP's own rules allow path-suffixed well-known URLs, which may let them sit under `/api`; that is for the follow-up tickets to settle against the spec.
- Middleware order: `IdentityModule` must be provided after the other modules, as AGENTS.md already says for handlers of a protected group; the MCP layer needs the same Identity services in its middleware.
- No clash with `HttpRouter.serve(Routes)` logging or the single process memory stores: all layers share the router built by `serve`.

## 6. OAuth 2.1 authorization server: what `effect` offers

### Provided

- `effect/jose` (`src/jose/*`, since 4.1.1, unstable), profile: compact serialization; HS256/384/512, RS256/384/512, PS256/384/512, ES256/384/512, EdDSA (Ed25519) signatures; `dir`/A256GCM encryption.
  - `Jwk.generateKeyPair({ algorithm, kid })` returns a public JWK and a `Redacted` private JWK; `Jwk.importPrivate`/`importPublic`, `exportPublic`, `exportPrivate`, `importPkcs8`/`importSpki`, `Jwk.thumbprint` (RFC 7638) and `thumbprintUri`.
  - `Jwt.sign(Schema, claims, privateKey, header?)` and `Jwt.verify(Schema, token, key, { issuer, audience, subject, typ, clockTolerance, maxTokenAge, requiredClaims })`; claims are encoded and decoded with a Schema, `exp`/`nbf` are always checked when present.
  - `Jws.sign`/`verify`; `Jwe.encrypt`/`decrypt`.
  - `Jwks.KeySet` is a Schema of public JWKs, usable as the body of the JWKS endpoint (`{ keys: [PublicJwk] }`); `Jwks.layerLocal(keySet)` serves a fixed set, `Jwks.layerRemote` fetches and caches a remote one; `Jwt.verifyWithKeySet` resolves by `alg` and `kid` through the `Jwks` service.
  - The module warns that token length is not bounded: apply a limit before verifying.
- `effect/crypto` (`src/crypto/*`): `SecureRandom` (random bytes for codes, refresh tokens, client secrets), `Digest.sha256` (for the PKCE S256 check and for storing refresh token hashes), `Mac`, `Signature`; `effect/encoding/Base64Url` (`encode` is unpadded base64url, what PKCE `code_challenge` needs). The server already provides `NodeCrypto.layerSecureRandom`/`layerDigest` in `IdentityModule`; `Signature` for `Jwk.generateKeyPair`/`Jwt.sign` would come from `NodeCrypto` as well (to confirm at build time, `@effect/platform-node` is installed).
- `HttpApiSecurity.bearer`, `apiKey`, `basic` for reading `Authorization`.
- `effect/ai/WorkloadIdentity.ts` is an OAuth token-exchange client for calling providers; it is not a server.

### Not provided (to build)

- No authorization server of any kind: no `/authorize`, `/token`, `/register` (RFC 7591 dynamic client registration), `/revoke`, introspection, consent flow, or grant store.
- No PKCE verifier helper: compute `base64url(sha256(code_verifier))` with `Digest` and `Base64Url` and compare in constant time.
- No metadata documents (RFC 8414 authorization server metadata, RFC 9728 protected resource metadata) and no `WWW-Authenticate: Bearer resource_metadata=...` challenge. `McpServer` never emits them; `McpClient` explicitly omits OAuth.
- No access token or refresh token policy, no scopes model, no resource indicator (RFC 8707) check: audience can be enforced with `Jwt.verify({ audience })` once the access token is a JWT.
- No client or consent UI; that is the web app's job (map decision).

## 7. Follow-ups this implies for the map

- #56 (and others blocked by #54): decide the access token form. A signed JWT verified with `Jwt.verify` is cheap and offline; revocation of a Grant then needs a Grant lookup at each request (the in-memory stores make that cheap) or short expiry plus refresh. `effect/jose` supports either.
- The HTTP-level `401` with the challenge header needs an `HttpRouter` middleware (or a `Authentication` bearer failure mapped to a `WWW-Authenticate`-carrying response), not `McpServer.middleware`.
- Tool derivation: decide the wrapping convention for non-object success schemas and the exposure annotation (`McpExposed`, next to `Permission`).
- Relay: confirm streaming of `text/event-stream` and add `/.well-known/*` routing.
- Testing: `McpTest` for tool listing and calls with an injected user; the assembled `Routes` through `HttpRouter.toWebHandler` for headers and `401`; `HttpApiTest` for handlers.
