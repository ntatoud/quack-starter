# 0003: Only `/api/mcp` accepts a bearer token; its tools reach `/api` in memory

Accepted, 2026-11-22. Decided in [#58](https://github.com/ntatoud/quack-starter/issues/58), amended by [#169](https://github.com/ntatoud/quack-starter/issues/169); built in [#177](https://github.com/ntatoud/quack-starter/issues/177).

## Context

An AI Client acts for a User with the access token of a Grant. Its MCP tools call the endpoints of `Api`, which the web app calls with the session cookie. If `/api` accepted the token too, every endpoint would have two credentials to defend, a leaked token would open the whole HTTP API, CSRF and CORS rules would have to hold for both, and every future endpoint would be reachable by AI Clients whether or not its context offered it as a tool.

## Decision

- Access tokens are opaque random strings, stored only as their SHA-256, like a Session's token, and looked up on every call. They last 1 hour, and their audience is the MCP resource identifier (`<PUBLIC_URL>/api/mcp`). No signing keys.
- `/api/mcp` is the only route that reads `Authorization: Bearer`. It answers 401 with `WWW-Authenticate: Bearer resource_metadata="..."` to a request with no token, or with one whose hash is unknown, whose audience is another resource, or that is expired, or whose Grant is expired or whose User is no longer `active`.
- `/api` over HTTP never accepts a bearer token: the session cookie stays its only credential.
- A tool calls its endpoint through an in-process client of the same `Api`: no network between. The caller travels in the context as an `McpCaller` (the Grant's User, with the token's Permissions that the Grant and the User's Role still give), which `Authentication` takes in place of the Session. Same handlers, same Permission check, same Owner rules.

## Consequences

- Nothing on the network accepts the token but the MCP endpoint, so only the endpoints a context marks with `McpTool` are reachable with it.
- The in-process routes are built outside the scope of the HTTP middleware that checks the token: inside it, every in-process call would be challenged for a token it does not carry. The MCP middleware reads the token a second time to provide the `McpCaller`, one more indexed lookup per call.
- Every call reads the Grant and its User, so a Grant that ends, or a User who leaves `active`, cuts the AI Client off at its next call. Revoking a Grant (#180) will act the same way.
