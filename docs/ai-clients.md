# AI Clients

How an AI Client (Claude, Claude Code, the MCP Inspector...) comes to call Quack's tools for a User. The words are those of `GLOSSARY.md`. The decisions: ADR 0003 (bearer tokens only on `/api/mcp`), ADR 0004 (Client ID Metadata Documents only), ADR 0005 (Permissions).

## The flow

1. **Discovery.** The AI Client calls `/api/mcp` with no token and gets 401 with `WWW-Authenticate: Bearer resource_metadata="<PUBLIC_URL>/.well-known/oauth-protected-resource/api/mcp"`. That document names the issuer, `PUBLIC_URL`, whose `/.well-known/oauth-authorization-server` names the authorization and token endpoints.
2. **Authorization.** The AI Client opens `<PUBLIC_URL>/oauth/authorize?client_id=...&redirect_uri=...&code_challenge=...&code_challenge_method=S256&resource=<PUBLIC_URL>/api/mcp&scope=...&state=...` in the User's browser. `client_id` is the URL of its Client ID Metadata Document. The web app signs the visitor in first if needed.
3. **Check.** The consent page posts the query to `/api/oauth/authorize/check`. The server fetches the document (`AiClientDocuments`), checks it, the redirect URI, PKCE, the resource, and the scope, and answers what the page shows, with a CSRF token.
4. **Approval.** The User approves: `/api/oauth/authorize/approve` stores the User's Grant to that AI Client (created, or updated in place: one Grant per User and AI Client) and a single-use authorization code (its SHA-256, for 1 minute), and answers the redirect URI with `code`, `state`, and `iss`. Denying answers it with `error=access_denied`.
5. **Exchange.** The AI Client posts the code to `/api/oauth/token` (form-urlencoded, CORS `*`, `Cache-Control: no-store`) with its `code_verifier`, the same `client_id`, `redirect_uri`, and `resource`. The code is spent on the first try, whatever the outcome. The answer: an access token, `token_type` `Bearer`, `expires_in` 3600, and the Grant's Permissions as `scope`. A refusal is an OAuth error, `{ error, error_description }`, with 400.
6. **Calls.** Each MCP request carries `Authorization: Bearer <token>`. `/api/mcp` finds the token by its hash, checks its audience, its expiry, and its Grant's, and that the User is `active`, then runs the request as the Grant's User with the Grant's Permissions that their Role still gives. A tool calls its endpoint in process (ADR 0003); `tools/list` hides a tool whose Permission the Grant lacks.

## Lifetimes

| What               | Lasts                          | Stored                               |
| ------------------ | ------------------------------ | ------------------------------------ |
| Authorization code | 1 minute, one exchange         | `authorization_codes`, SHA-256       |
| Access token       | 1 hour                         | `grant_access_tokens`, SHA-256       |
| Grant              | 30 days from the last approval | `grants`, one per User and AI Client |

Grants and their tokens go with their User (`ON DELETE CASCADE`).

## Where the code is

- Contract: `packages/contracts/src/oauth/` (the `oauth` group: `authorize/*` behind `Authentication`, `token` after it).
- Server: `apps/server/src/modules/identity/` (`AuthorizationRequests`, `Grants`, the `GrantStore` and `AuthorizationCodeStore` ports), `apps/server/src/mcp/` (the transport and its tools).
- Web: `apps/web/src/features/oauth/` (the consent page).
