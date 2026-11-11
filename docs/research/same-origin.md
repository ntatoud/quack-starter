# Same-origin: Vite proxy, TanStack Start, and production options

Research for ticket #20 (map #18). Facts only; the decision is #25.

Versions read: `@tanstack/react-start` 1.169.5, `@tanstack/react-router` 1.170.46, `vite-plus` 1.6.0 (Vite core bundled in `@voidzero-dev/vite-plus-core` 1.6.0), `effect` 4.1.4. "Tested" means run in this repo on 2026-11-11 with a throwaway Node echo server standing in for the API (it sets two `Set-Cookie` headers and echoes the `Cookie`, `Origin` and `Host` it receives) and temporary config changes, all reverted. No cookie logic exists in the repo yet.

## Current state of the repo

- Web on :3000, API on :3001. Browser calls go cross-origin to `VITE_API_URL` (default `http://localhost:3001`): `HttpApiClient.make(Api, { baseUrl: env.VITE_API_URL })` over `FetchHttpClient.layer` (`apps/web/src/lib/api.ts`).
- Server CORS: `HttpRouter.cors({ allowedOrigins: [webOrigin] })`, no `credentials` (`apps/server/src/server.ts`).
- Today the API is only called through `useQuery` / `useMutation` in `TodosCard.tsx`. No route has a `loader`, so no API call happens during SSR.
- `vp build` produces `apps/web/dist/client` (static assets) and `apps/web/dist/server/server.js`. The server file only exports a fetch handler (`export default { fetch }`, from `createServerEntry({ fetch })`); it does not listen on a port. Tested: no `.output`, no Node server entry.

## Option A: Vite `server.proxy` (dev) and `preview.proxy`

Source: Vite docs `config/server-options.md#server.proxy`; types in `@voidzero-dev/vite-plus-core/dist/vite/node/index.d.ts` (`ProxyOptions extends ServerOptions$3`, backed by `http-proxy-3`).

- Rules match by path prefix (key starts with `^` means RegExp). "If a request matches any of the configured proxy rules, the request won't be transformed by Vite." `rewrite(path)` strips the prefix.
- Available options include `changeOrigin`, `xfwd`, `cookieDomainRewrite`, `cookiePathRewrite`, `headers`, `ws`, `configure`, `bypass`.
- `preview.proxy` exists too (`PreviewOptions` shares `CommonServerOptions`). Vite docs for `vite preview`: "Do not use this as a production server as it's not designed for it." (`guide/cli.md`).
- Tested with `server.proxy["/api"] = { target, rewrite }` (no `changeOrigin`, no `xfwd`):
  - `Cookie: sid=zzz` sent to the web port reached the API unchanged.
  - Both `Set-Cookie` headers came back unchanged to the client (multiple headers preserved).
  - `Origin` reached the API as sent by the client; `Host` reached it as the web host (`localhost:4100`), because `changeOrigin` is off. `X-Forwarded-*` were absent (`xfwd` off).
  - Same behavior with `vp preview` on the built output.
- The proxy only exists in the Vite dev server and in `vite preview`. The proxy runs in Vite's connect middleware, before TanStack Start's handler.
- Vite dev server CORS (`server.cors`) defaults to allowing localhost, `127.0.0.1` and `::1` origins on any port (`server-options.md#server.cors`). Tested: proxied responses carried `Access-Control-Allow-Origin: <request origin>` added by Vite. Irrelevant for same-origin requests, which send no CORS check.

## Option B: TanStack Start server route that relays `/api`

Source: `skills/start-core/server-routes/SKILL.md` shipped in `@tanstack/start-client-core` 1.170.39 (from `docs/start/framework/react/guide/server-routes.md`).

- A file route with `server.handlers` (`GET`, `POST`, ...) receives `{ request, params, context, pathname, next }` and returns a `Response`. A splat file (`routes/api/$.ts`, route `/api/$`) matches every sub-path.
- Tested in dev with `routes/proxy/$.ts`: `fetch(new Request(new URL(path + search, API_ORIGIN), request))`.
  - `Cookie` forwarded, `Origin` forwarded, query string preserved, POST worked.
  - Both `Set-Cookie` headers returned to the client intact (returning the upstream `Response` keeps them).
  - `Host` seen by the API was the API's own host (set by `fetch` from the target URL).
- It is the same code in dev and in production, and it runs wherever the Start server entry runs (the fetch handler in `dist/server/server.js`).
- Not tested: streaming bodies, large uploads, `content-encoding` / `content-length` handling when relaying a `fetch` response, WebSockets.
- Server routes do not run an auth check for you: "A router `beforeLoad` redirect does not protect `/api/...`" (same SKILL.md).

## Option C: reverse proxy in production

- The Start build is a fetch handler plus static client assets (see above); something has to host it. TanStack hosting docs (`docs/start/framework/react/guide/hosting.md`) list Cloudflare Workers, Netlify, Nitro (Vercel, Railway, Node, Docker, Bun) and `node-server`. For Nitro: `plugins: [tanstackStart(), nitro(), viteReact()]` then `node .output/server/index.mjs`. This repo has none of these plugins today.
- A reverse proxy (nginx, Caddy, a platform router, a CDN rule) in front of both processes routes `/api/*` to the Effect server and everything else to Start. This is outside both apps; the Effect server needs no change except the path prefix (see below).
- Nothing in the repo or the packages read configures a prod proxy; this option is infrastructure, not code in `apps/web`.

## SSR: does the Start server call the API with the visitor's cookie?

Tested in dev on a route with a `loader` (`/ssr`), request sent with `Cookie: sid=zzz`:

| SSR call                                                             | Result                                                                                                                                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fetch("http://api/...")` in the loader                              | Reaches the API with `cookie: null`. Nothing forwards the incoming cookie automatically.                                                                                              |
| `fetch("/api/...")` (relative) in the loader                         | Throws `TypeError: Failed to parse URL from /api/rel`. Node's `fetch` has no base URL on the server; Vite's proxy is not involved. Same error in the built output under `vp preview`. |
| Server function using `getRequestHeader("cookie")` and forwarding it | API receives `cookie: sid=zzz`.                                                                                                                                                       |

- The upstream `Set-Cookie` of an SSR-side call is only visible to the server code (`response.headers.getSetCookie()` returned both values). Nothing sends it to the browser unless the code does it. The Start docs say to use `setCookie` or `appendResponseHeader('set-cookie', ...)`, not `setResponseHeader('Set-Cookie', ...)`, which "replaces every cookie on the outgoing response" (`skills/start-core/auth-server-primitives/SKILL.md`).
- Server utilities (`getRequest`, `getRequestHeader`, `setResponseHeader`, `setResponseHeaders`, `setResponseStatus`) come from `@tanstack/react-start/server` (`skills/react-start/SKILL.md`).
- TanStack's guidance: a loader runs during SSR and on client navigation, "so `fetch('/api/...')` is not a portable loader pattern", and an SSR loader should not call its own server route (`server-routes/SKILL.md`).
- `api.ts` builds one module-level `ManagedRuntime` with a fixed `baseUrl`. The router's QueryClient is created per request (`router.tsx`), but `api`'s runtime is shared by all requests on the server. The current client has no per-request header hook (an Effect `FetchHttpClient.RequestInit` service exists for defaults, `effect/src/http/FetchHttpClient.ts`, but it is provided at layer build, not per request).
- In the browser a relative `baseUrl` (e.g. `/api`) works; on the server it needs an absolute URL. `HttpApiClient.make(Api, { baseUrl })` takes the string as given.

## Cookies by option

|                       | Browser to API cookie flow                                               | SSR to API cookie flow                                                                                            |
| --------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| A. Vite proxy         | `Cookie` and `Set-Cookie` pass through; cookie belongs to the web origin | Not covered by the proxy (proxy is browser-facing only); SSR must call the API directly with a forwarded `Cookie` |
| B. Start server route | `Cookie` and `Set-Cookie` pass through (tested)                          | Same as A for the loader; a server function could also call the API directly                                      |
| C. Reverse proxy      | Passes headers as configured by the proxy (not tested here)              | Same as A                                                                                                         |

Path and domain attributes: `http-proxy-3` supports `cookieDomainRewrite` and `cookiePathRewrite` on Option A. If the API is mounted under `/api` and sets `Path=/`, the browser stores it for `/` of the web origin (no rewrite needed); a prefix-stripping `rewrite` means the API itself never sees `/api`.

## CORS impact

- Same-origin requests (browser page and `/api` on one origin) are not subject to CORS: no `Origin`-based allow check, no preflight. Per MDN CORS guide, CORS applies to cross-origin requests.
- Under Options A, B or C, the `webOrigin` allow list in `server.ts` is only needed if something still calls the API cross-origin. SSR calls from Node are not browser requests, so CORS does not apply to them.
- `Origin` reaches the API on proxied non-GET requests with the web origin (tested for A and B), so any server-side Origin check sees the web origin, not the API's.

## Cross-origin cookie requirements (what the current setup would need)

Primary: MDN CORS guide (`web/http/guides/cors`), MDN `Set-Cookie` reference, Effect source.

- Client: `fetch(..., { credentials: "include" })`. Default `credentials` is `same-origin`, so cross-origin cookies are neither sent nor stored. In this repo the fetch layer is `FetchHttpClient.layer`; `FetchHttpClient.RequestInit` is the documented way to give it defaults (`effect/src/http/FetchHttpClient.ts`).
- Server, Effect v4: `HttpRouter.cors({ allowedOrigins, credentials: true })` emits `Access-Control-Allow-Credentials: true` (`effect/src/http/HttpMiddleware.ts`). Default is `credentials: false`. With exactly one allowed origin it sends that origin plus `Vary: Origin`; with zero entries it sends `*`.
- MDN: with credentials the server "must not" use `*` for `Access-Control-Allow-Origin`, `Allow-Headers`, `Allow-Methods` or `Expose-Headers`; a `Set-Cookie` in a response with `*` does not set the cookie.
- Effect's `cors` with empty `allowedHeaders` echoes the request's `Access-Control-Request-Headers`, so it does not emit `*` for headers. Its `FetchHttpClient` doc says trace propagation is on by default and "a browser preflight fails unless the target allows `b3` and `traceparent`".
- `SameSite`: `localhost:3000` and `localhost:3001` are different origins but the same site (ports do not matter for site), so `SameSite=Lax` / `Strict` cookies are still sent on those fetches when `credentials: "include"` is set; cookies are also not port-scoped. A truly cross-site API (different registrable domain) needs `SameSite=None; Secure` (MDN `Set-Cookie`), and browsers may block third-party cookies regardless (MDN CORS guide, "Third-party cookies"). The `__Host-` prefix (used in TanStack's auth guide) requires `Secure`, `Path=/` and no `Domain`, binding the cookie to one origin.
- Not tested in a real browser: these browser behaviors are taken from the MDN pages and the Effect source, not observed here.

## Open items found while reading (not decisions)

- `WEB_ORIGIN` and `VITE_API_URL` are the only coupling points between the two apps today; same-origin makes `VITE_API_URL` a path or a server-side absolute URL.
- The prod host for the Start server (Nitro, Node, edge) is not chosen; Option B runs inside whichever is chosen, Option C sits in front of it.
- Not read: Nitro's own proxy features (`routeRules`), Cloudflare/Netlify/Vercel rewrite rules.
