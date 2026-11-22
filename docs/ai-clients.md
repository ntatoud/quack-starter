# AI Clients

How an AI Client (Claude, Claude Code, the MCP Inspector...) comes to call Quack's tools for a User. The words are those of `GLOSSARY.md`. The decisions: ADR 0003 (bearer tokens only on `/api/mcp`), ADR 0004 (Client ID Metadata Documents only), ADR 0005 (Permissions).

## The flow

1. **Discovery.** The AI Client calls `/api/mcp` with no token and gets 401 with `WWW-Authenticate: Bearer resource_metadata="<PUBLIC_URL>/.well-known/oauth-protected-resource/api/mcp"`. That document names the issuer, `PUBLIC_URL`, whose `/.well-known/oauth-authorization-server` names the authorization and token endpoints.
2. **Authorization.** The AI Client opens `<PUBLIC_URL>/oauth/authorize?client_id=...&redirect_uri=...&code_challenge=...&code_challenge_method=S256&resource=<PUBLIC_URL>/api/mcp&scope=...&state=...` in the User's browser. `client_id` is the URL of its Client ID Metadata Document. The web app signs the visitor in first if needed.
3. **Check.** The consent page posts the query to `/api/oauth/authorize/check`. The server fetches the document (`AiClientDocuments`), checks it, the redirect URI, PKCE, the resource, and the scope, and answers what the page shows, with a CSRF token.
4. **Approval.** The User approves: `/api/oauth/authorize/approve` stores the User's Grant to that AI Client (created, or updated in place: one Grant per User and AI Client, whose Permissions become exactly those approved now and whose earlier access and refresh tokens are revoked) and a single-use authorization code (its SHA-256, for 1 minute), and answers the redirect URI with `code`, `state`, and `iss`. Denying answers it with `error=access_denied`.
5. **Exchange.** The AI Client posts the code to `/api/oauth/token` (form-urlencoded, CORS `*`, `Cache-Control: no-store`) with its `code_verifier`, the same `client_id`, `redirect_uri`, and `resource`. The code is spent on the first try, whatever the outcome. The answer: an access token, `token_type` `Bearer`, `expires_in` 3600, a refresh token, and as `scope` the Permissions approved with the code that the Grant still holds. The tokens keep them: approving more later gives an earlier code no more. A refusal is an OAuth error, `{ error, error_description }`, with 400.
6. **Refresh.** Before its access token ends, the AI Client posts `grant_type=refresh_token` with its refresh token and the same `client_id` (`resource` may be left out) to `/api/oauth/token`, and gets new tokens with the same Permissions, less those the Grant lost since. The refresh token it presented is replaced, and the Grant lasts 30 days from then, in one transaction. A refused refresh replaces nothing: the AI Client may try again with the same token. A refresh token presented again, once replaced, shows two AI Clients hold it, one a thief: Quack revokes the whole Grant, and the User must approve again.
7. **Calls.** Each MCP request carries `Authorization: Bearer <token>`. `/api/mcp` finds the token by its hash, checks its audience, its expiry, and its Grant's, and that the User is `active` (a Grant that expired, or whose User is not, is removed then), then runs the request as the Grant's User with the token's Permissions that the Grant and their Role still give. A token with no valid Grant gets 401 with `error="invalid_token"`. A tool calls its endpoint in process (ADR 0003); `tools/list` shows every tool a Grant may open, those the Grant lacks the Permission for included: an AI Client calls only the tools it sees, so a hidden one could never lead it to step up. It hides a tool no Grant may open.
8. **Step-up.** A `tools/call` of a tool whose Permission the token lacks gets 403 before any JSON-RPC, decided from its `Mcp-Name` header, with `WWW-Authenticate: Bearer error="insufficient_scope", scope="...", resource_metadata="..."`. `scope` names the Permissions the token holds and the one it lacks, since approving sets the Grant to exactly what is approved. A tool whose Permission no Grant may hold gets no step-up, which would loop: the MCP server refuses it. The AI Client sends the User back to step 2 with that scope; the consent page names only what is new ("now also wants todos:write") and marks each Permission in the details as already given or new.

## Lifetimes

| What               | Lasts                                                          | Stored                                              |
| ------------------ | -------------------------------------------------------------- | --------------------------------------------------- |
| Authorization code | 1 minute, one exchange                                         | `authorization_codes`, SHA-256                      |
| Access token       | 1 hour                                                         | `grant_access_tokens`, SHA-256                      |
| Refresh token      | Until used once, or its Grant ends                             | `grant_refresh_tokens`, SHA-256, kept once replaced |
| Grant              | 30 days from the last approval or refresh, with no other limit | `grants`, one per User and AI Client                |

A Grant ends sooner when:

- its AI Client presents a replaced refresh token: the Grant and all its tokens are removed;
- its User is no longer `active`: the next call or refresh gets 401 or `invalid_grant`, and removes the Grant, as their Session ends at its next request;
- its User is deleted: Grants and their tokens go with them (`ON DELETE CASCADE`).

An expired Grant's tokens get 401 on `/api/mcp` and `invalid_grant` at the token endpoint.

## Where the code is

- Contract: `packages/contracts/src/oauth/` (the `oauth` group: `authorize/*` behind `Authentication`, `token` after it).
- Server: `apps/server/src/modules/identity/` (`AuthorizationRequests`, `Grants`, the `GrantStore` and `AuthorizationCodeStore` ports), `apps/server/src/mcp/` (the transport and its tools).
- Web: `apps/web/src/features/oauth/` (the consent page).
