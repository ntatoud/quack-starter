# AI Clients

How an AI Client (Claude, Claude Code, the MCP Inspector...) comes to call Quack's tools for a User. The words are those of `GLOSSARY.md`. The decisions: ADR 0003 (bearer tokens only on `/api/mcp`), ADR 0004 (Client ID Metadata Documents only), ADR 0005 (Permissions).

## The flow

1. **Discovery.** The AI Client calls `/api/mcp` with no token and gets 401 with `WWW-Authenticate: Bearer resource_metadata="<PUBLIC_URL>/.well-known/oauth-protected-resource/api/mcp"`. That document names the issuer, `PUBLIC_URL`, whose `/.well-known/oauth-authorization-server` names the authorization and token endpoints.
2. **Authorization.** The AI Client opens `<PUBLIC_URL>/oauth/authorize?client_id=...&redirect_uri=...&code_challenge=...&code_challenge_method=S256&resource=<PUBLIC_URL>/api/mcp&scope=...&state=...` in the User's browser. `client_id` is the URL of its Client ID Metadata Document. The web app signs the visitor in first if needed.
3. **Check.** The consent page posts the query to `/api/oauth/authorize/check`. The server fetches the document (`AiClientDocuments`), checks it, the redirect URI, PKCE, the resource, and the scope, and answers what the page shows, with a CSRF token.
4. **Approval.** The consent page lists every Permission a Grant may hold as a checkbox: those the request asks for, and those the Grant already holds, start ticked. The User may untick some or tick more, and approves the ticked ones (Approve needs one at least): `/api/oauth/authorize/approve` takes them as `permissions`, refuses one no Grant may hold (`invalid_scope`), and stores the User's Grant to that AI Client (created, or updated in place: one Grant per User and AI Client, whose Permissions become exactly those approved now and whose earlier access and refresh tokens are revoked) and a single-use authorization code (its SHA-256, for 1 minute), and answers the redirect URI with `code`, `state`, and `iss`. Denying answers it with `error=access_denied`.
5. **Exchange.** The AI Client posts the code to `/api/oauth/token` (form-urlencoded, CORS `*`, `Cache-Control: no-store`) with its `code_verifier`, the same `client_id`, `redirect_uri`, and `resource`. The code is spent on the first try, whatever the outcome. The answer: an access token, `token_type` `Bearer`, `expires_in` 3600, a refresh token, and as `scope` the Permissions approved with the code that the Grant still holds. The tokens keep them, until the User changes the Permissions of the Grant in their settings (below): approving more on the consent page later gives an earlier code no more. A refusal is an OAuth error, `{ error, error_description }`, with 400.
6. **Refresh.** Before its access token ends, the AI Client posts `grant_type=refresh_token` with its refresh token and the same `client_id` (`resource` may be left out) to `/api/oauth/token`, and gets new tokens with the same Permissions, less those the Grant lost since. The refresh token it presented is replaced, and the Grant lasts 30 days from then, in one transaction. A refused refresh replaces nothing: the AI Client may try again with the same token. A refresh token presented again, once replaced, shows two AI Clients hold it, one a thief: Quack revokes the whole Grant, and the User must approve again.
7. **Calls.** Each MCP request carries `Authorization: Bearer <token>`. `/api/mcp` finds the token by its hash, checks its audience, its expiry, and its Grant's, and that the User is `active` (a Grant that expired, or whose User is not, is removed then), then runs the request as the Grant's User with the token's Permissions that the Grant and their Role still give. A token with no valid Grant gets 401 with `error="invalid_token"`. A tool calls its endpoint in process (ADR 0003); `tools/list` shows every tool a Grant may open, those the Grant lacks the Permission for included: an AI Client calls only the tools it sees, so a hidden one could never lead it to step up. It hides a tool no Grant may open.
8. **Step-up.** A `tools/call` of a tool whose Permission the token lacks gets 403 before any JSON-RPC, decided from its `Mcp-Name` header, with `WWW-Authenticate: Bearer error="insufficient_scope", scope="...", resource_metadata="..."`. `scope` names the Permissions the token holds and the one it lacks, since approving sets the Grant to exactly what is approved. A tool whose Permission no Grant may hold gets no step-up, which would loop: the MCP server refuses it. The AI Client sends the User back to step 2 with that scope; the consent page names only what is new ("now also wants todos:write") and marks each Permission as already given or new. When Quack remembers the consent, the page approves what the Grant holds, so it never narrows the Grant.

## Lifetimes

| What               | Lasts                                                          | Stored                                              |
| ------------------ | -------------------------------------------------------------- | --------------------------------------------------- |
| Authorization code | 1 minute, one exchange                                         | `authorization_codes`, SHA-256                      |
| Access token       | 1 hour                                                         | `grant_access_tokens`, SHA-256                      |
| Refresh token      | Until used once, or its Grant ends                             | `grant_refresh_tokens`, SHA-256, kept once replaced |
| Grant              | 30 days from the last approval or refresh, with no other limit | `grants`, one per User and AI Client                |

A Grant ends sooner when:

- its User revokes it, in the AI Clients section of their settings (`DELETE /api/grants/:id`): the Grant and all its tokens are removed, so the AI Client's next call gets 401;
- its AI Client presents a replaced refresh token: the Grant and all its tokens are removed;
- its User is no longer `active`: the next call or refresh gets 401 or `invalid_grant`, and removes the Grant, as their Session ends at its next request;
- its User is deleted: Grants and their tokens go with them (`ON DELETE CASCADE`).

An expired Grant's tokens get 401 on `/api/mcp` and `invalid_grant` at the token endpoint.

The User may also change the Permissions of a Grant there, fewer or more, but never none, which Revoke covers: the dialog of the AI Client lists every Permission a Grant may hold, and states what it gains and loses before the User confirms (`PATCH /api/grants/:id` with all the `permissions` it now holds; one no Grant may hold is refused). The Grant and its access and refresh tokens change at once, in one statement: a choice in the settings is an approval too. The AI Client's next call needing a removed Permission gets a step-up (403 `insufficient_scope`); one it gained works on its next call, with no consent page.

## Limits

The `AttemptLimiter` of `docs/identity.md` guards two OAuth routes, with the limits in `ServerConfig.attemptLimits`:

- `authorize/check` counts, per User, the fetches of a document that miss the cache (`clientDocumentFetchesPerUser`, 30 in 15 minutes); past it, `TooManyAttempts` (429), which the consent page words.
- `token` counts, per address, the requests refused with `invalid_grant` (`tokenFailuresPerIp`, 20 in 15 minutes), and never a success. Past it, 429 with `Retry-After` and an OAuth error, `{ "error": "invalid_request", "error_description": "Too many attempts, retry in N seconds" }`. A request is counted before it is tried, so concurrent guesses do not all get through, and given back when it succeeds or fails otherwise.
- `approve` and `deny` have none: they need a Session and the CSRF token of a request `check` counted. `/api/mcp` has none either.

## Where the code is

- Contract: `packages/contracts/src/oauth/` (the `oauth` group: `authorize/*` behind `Authentication`, `token` after it).
- Server: `apps/server/src/modules/identity/` (`AuthorizationRequests`, `Grants`, the `GrantStore` and `AuthorizationCodeStore` ports), `apps/server/src/mcp/` (the transport and its tools).
- Contract of the Grants a User sees, changes, and revokes: `packages/contracts/src/grants/` (no MCP tool: an AI Client never lists, changes, or revokes Grants).
- Web: `apps/web/src/features/oauth/` (the consent page), `apps/web/src/features/grants/` (the AI Clients section of the settings: each Grant, when it was last used, to the minute, and the ones that need a look).
