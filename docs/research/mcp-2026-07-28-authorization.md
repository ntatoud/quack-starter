# What the MCP 2026-07-28 spec requires for authorization

Research for issue #53 (map #52). Primary sources only: the MCP specification at revision `2026-07-28`, and the RFCs and drafts it cites. Fetched 2026-11-13.

Roles used below:

- **RS**: the protected MCP server (OAuth 2.1 resource server). Quack's MCP endpoint.
- **AS**: the authorization server. Quack too, so both columns bind Quack.
- **Client**: the AI Client (OAuth client). Listed only where it shapes what Quack must accept.

Sources (all `https://modelcontextprotocol.io/specification/2026-07-28/` unless noted):

- `basic/authorization` (AUTH)
- `basic/authorization/authorization-server-discovery` (DISC)
- `basic/authorization/client-registration` (REG)
- `basic/authorization/security-considerations` (SEC)
- `basic/transports/streamable-http` (HTTP)
- `changelog` (CHANGELOG)
- RFC 9728, RFC 8414, RFC 8707, RFC 7591, RFC 9207, RFC 6750, `draft-ietf-oauth-client-id-metadata-document-00` (CIMD), `draft-ietf-oauth-v2-1-13` (OAuth 2.1).

## 1. Summary

1. Authorization is OPTIONAL in MCP, but for HTTP transports an implementation SHOULD conform (AUTH, Protocol Requirements). Quack decided to require it on every call, so treat every MUST below as binding.
2. Quack as RS MUST publish Protected Resource Metadata (RFC 9728) with `authorization_servers` (at least one), MUST validate that every token was issued for it (audience), MUST answer 401 for missing, invalid or expired tokens, and SHOULD send `scope` in the challenge.
3. Quack as AS MUST implement OAuth 2.1 and MUST publish RFC 8414 or OIDC Discovery metadata. It SHOULD support Client ID Metadata Documents (CIMD). Dynamic Client Registration (DCR) is MAY and now deprecated. PKCE with `S256` is effectively mandatory: the AS MUST advertise `code_challenge_methods_supported` or clients refuse to proceed.
4. The `2026-07-28` Streamable HTTP transport is stateless: no `Mcp-Session-Id`, no GET stream, no `initialize`. A bearer token rides on every POST, so authorization is per request and never tied to a protocol session.
5. Path constraint: the PRM well-known URL is derived from the MCP endpoint URL by path insertion, and the AS metadata URL from the issuer by path insertion. Both live under `/.well-known/` at the origin root, which is outside Quack's `/api` prefix. See section 8.

## 2. What changed since 2025-11-25

From CHANGELOG, authorization and transport items only:

| Change | Effect on Quack |
| --- | --- |
| Protocol-level sessions and `Mcp-Session-Id` removed (SEP-2567) | No session store for MCP; a Grant is the only server-side state |
| `initialize` handshake removed; every request carries `_meta` protocol version and capabilities (SEP-2575) | Each POST is independently authenticated |
| GET stream removed, replaced by `subscriptions/listen` (a long-lived POST response) | Server answers GET and DELETE on the endpoint with 405 |
| SSE resumability (`Last-Event-ID`) removed | A dropped stream loses the request; nothing to resume under auth |
| `Mcp-Method` and `Mcp-Name` request headers REQUIRED on POST | Relay must pass them through unchanged |
| AS SHOULD include `iss` in authorization responses (RFC 9207); clients MUST validate a present `iss` (SEP-2468) | Quack AS: emit `iss` and advertise `authorization_response_iss_parameter_supported: true` |
| DCR clients MUST send `application_type` (SEP-837) | Only matters if Quack supports DCR |
| Client credentials bound to issuer, clients MUST re-register when the AS changes (SEP-2352) | The issuer value is a stable identity; changing it breaks registered clients |
| DCR deprecated in favor of CIMD (PR 2858) | CIMD is the primary registration path |

The authorization prose that moved into separate pages (DISC, REG, SEC) keeps the 2025-11-25 core: PRM discovery, RFC 8414/OIDC discovery with the multi-endpoint order, CIMD as SHOULD, PKCE S256, RFC 8707 `resource`, step-up on 403.

## 3. Protected resource (RS) requirements

### 3.1 Protected Resource Metadata (RFC 9728)

| Requirement | Level | Source |
| --- | --- | --- |
| Implement RFC 9728 PRM | MUST | AUTH Overview 4; DISC Authorization Server Location |
| PRM document includes `authorization_servers` with at least one entry | MUST | DISC Authorization Server Location |
| Expose the PRM URL via `resource_metadata` in the `WWW-Authenticate` header of 401 responses, OR serve it at a well-known URI (one of the two) | MUST (one of) | DISC PRM Discovery Requirements |
| `resource` field: the resource identifier, identical to the identifier the client used; client MUST NOT use the data otherwise | MUST (RFC 9728 required field) | RFC 9728 s2, s3.3 |
| `scopes_supported`: minimal set for basic functionality; omit `offline_access` | RECOMMENDED by RFC 9728; SHOULD NOT include `offline_access` | RFC 9728 s2; AUTH Refresh Tokens |
| Respond 200 with `application/json`; ignore unknown parameters; omit empty values | MUST | RFC 9728 s3.2 |
| Optional fields: `jwks_uri`, `bearer_methods_supported`, `resource_name`, `resource_documentation`, DPoP and mTLS fields | MAY | RFC 9728 s2 |

Resource identifier rules (RFC 9728 s2): `https`, no fragment, query SHOULD NOT be present. MCP canonical URI guidance (AUTH, Canonical Server URI): examples `https://mcp.example.com/mcp`, `https://mcp.example.com`; no trailing slash preferred (SHOULD); a path component is allowed when needed to identify the server.

Well-known URL construction (RFC 9728 s3.1, DISC): insert `/.well-known/oauth-protected-resource` between host and path. Two spec-blessed placements:

- At the endpoint path: MCP endpoint `https://example.com/public/mcp` gives `https://example.com/.well-known/oauth-protected-resource/public/mcp`.
- At the root: `https://example.com/.well-known/oauth-protected-resource`.

Clients MUST use the `resource_metadata` URL from `WWW-Authenticate` when present; otherwise they MUST probe the path-inserted URL first, then the root (DISC). So Quack may rely on the header alone, but serving the well-known URL too costs little and covers clients that probe.

### 3.2 Token validation and audience

| Requirement | Level | Source |
| --- | --- | --- |
| Validate access tokens per OAuth 2.1 s5.2 before processing | MUST | AUTH Token Handling; SEC Access Token Privilege Restriction |
| Validate the token was issued specifically for this RS as audience (RFC 8707) and reject tokens that do not include it | MUST | AUTH Token Handling; SEC |
| Accept only tokens valid for its own resources; do not accept or transit any other token | MUST / MUST NOT | AUTH Token Handling |
| Never pass the client's token to an upstream API | MUST NOT | SEC Access Token Privilege Restriction |
| Invalid or expired token gets HTTP 401 | MUST | AUTH Token Handling |
| Bearer token only in `Authorization: Bearer`, on every request, never in the query string | Client MUST | AUTH Token Requirements |
| Return no data to unauthorized parties | MUST | SEC |

Because RS and AS are the same app, audience validation is a local check: the access token's audience (the `resource` bound at issue time) must equal the MCP endpoint's resource identifier. A Session cookie is not a Grant: the MCP endpoint takes bearer tokens only.

### 3.3 Challenges and scope

| Situation | Response | Level | Source |
| --- | --- | --- | --- |
| No or invalid token | `401` with `WWW-Authenticate: Bearer resource_metadata="<PRM URL>"` | MUST 401; MUST (header or well-known) | AUTH Error Handling; DISC |
| Same, with scope guidance | add `scope="..."` | SHOULD | AUTH Scope Selection Strategy |
| Token lacks scope | `403` with `Bearer error="insufficient_scope", scope="a b", resource_metadata="...", error_description="..."` | SHOULD (403 and parameters); `error_description` optional | AUTH Runtime Insufficient Scope Errors |
| Malformed authorization request | `400` | MUST appropriate status | AUTH Error Handling |
| Origin header present and invalid | `403` | MUST | HTTP Security & Endpoint |

Scope rules for the RS:

- Include all scopes needed for the current operation in a single challenge, not one at a time (SHOULD).
- Be consistent in how scope sets are built (SHOULD).
- Account for scope hierarchies when judging sufficiency: a broader scope implies narrower ones (MUST). Quack's `todos:list` / `todos:write` / `todos:delete` have no hierarchy today; if one is added it must be honored.
- The challenged scopes need not match `scopes_supported` and need not include already-granted scopes; clients union them (AUTH Step-Up).
- Do not surface `offline_access` in `scope` or `scopes_supported` (SHOULD NOT).

Clients retry step-up only a few times (client SHOULD limit).

### 3.4 Transport rules that touch auth (RS side)

| Requirement | Level | Source |
| --- | --- | --- |
| One MCP endpoint path that supports POST | MUST | HTTP |
| Validate `Origin` on all connections; invalid present value gets 403 | MUST | HTTP Security & Endpoint |
| Implement proper authentication for all connections | SHOULD (Quack: required by decision) | HTTP |
| Validate `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name` headers against the body; mismatch gets 400 with code `-32020` | MUST | HTTP Server Validation |
| Unsupported version gets 400 and `UnsupportedProtocolVersionError`; unknown method gets 404 with `-32601` | MUST | HTTP Protocol Version Header |
| Ignore `Mcp-Session-Id` and `Last-Event-ID`; do not mint session IDs | SHOULD | HTTP Earlier Streamable HTTP Revisions |
| GET or DELETE on the endpoint gets 405 | SHOULD | HTTP Earlier Streamable HTTP Revisions |
| Notification POST accepted gets 202 and no body | MUST | HTTP Sending Messages |
| Request POST returns JSON or an SSE stream scoped to that request | MUST | HTTP Sending Messages |
| Send `X-Accel-Buffering: no` on SSE | SHOULD | HTTP Receiving Messages |
| Closing the SSE stream cancels the request | MUST | HTTP Cancellation |

Statelessness consequences: no session to bind a token to, so every POST re-validates the bearer token. A revoked Grant takes effect on the next request. Long-lived `subscriptions/listen` streams outlive a single validation, so revocation or expiry mid-stream needs an explicit decision (the spec is silent).

## 4. Authorization server (AS) requirements

### 4.1 Core

| Requirement | Level | Source |
| --- | --- | --- |
| Implement OAuth 2.1 with appropriate security for confidential and public clients | MUST | AUTH Overview 1 |
| Provide RFC 8414 metadata or OIDC Discovery 1.0 (at least one) | MUST | AUTH Overview 5 |
| All AS endpoints over HTTPS | MUST | SEC Communication Security |
| Redirect URIs are `localhost` or HTTPS | MUST | SEC Communication Security |
| Exact-match validation of redirect URIs against registered values | MUST | SEC Open Redirection |
| Prevent redirecting user agents to untrusted URIs (OAuth 2.1 s7.12.2) | MUST | SEC Open Redirection |
| Short-lived access tokens | SHOULD | SEC Token Theft |
| Rotate refresh tokens for public clients (OAuth 2.1 s4.3.1) | MUST | SEC Token Theft |
| Include `iss` in authorization responses, errors included (RFC 9207) | SHOULD (expected to become MUST) | AUTH Authorization Response Validation |
| If `iss` is sent, advertise `authorization_response_iss_parameter_supported: true` | MUST | AUTH Authorization Response Validation |
| Support `resource` (RFC 8707) and audience-restrict tokens; reject bad `resource` with `invalid_target` | SHOULD (RFC 8707); the RS audience check makes it effectively MUST for Quack | RFC 8707 s2; SEC |
| Follow OAuth 2.1 security best practices | MUST | SEC intro |

OAuth 2.1 (draft-13) removes implicit and password grants, requires PKCE for the authorization code flow, requires exact redirect URI matching, and forbids bearer tokens in query strings. Quack needs the `authorization_code` grant, and `refresh_token` if it issues refresh tokens.

### 4.2 Authorization Server Metadata (RFC 8414)

Required by RFC 8414 s2, plus MCP additions:

| Field | Level | Note |
| --- | --- | --- |
| `issuer` | REQUIRED | https, no query or fragment; MUST equal the issuer used to build the metadata URL (clients reject a mismatch) |
| `authorization_endpoint` | REQUIRED (we use the code flow) | The consent page; this is a web app page |
| `token_endpoint` | REQUIRED | |
| `response_types_supported` | REQUIRED | `["code"]` |
| `code_challenge_methods_supported` | MUST be present, containing `S256` | If absent, clients MUST refuse to proceed (SEC Authorization Code Protection). RFC 8414 alone lists it OPTIONAL; MCP promotes it. |
| `client_id_metadata_document_supported` | SHOULD be `true` if CIMD supported | REG Advertising CIMD Support; CIMD s5 |
| `registration_endpoint` | MAY | Only if DCR is offered |
| `scopes_supported` | RECOMMENDED | `todos:list`, `todos:write`, `todos:delete`, ... |
| `grant_types_supported`, `token_endpoint_auth_methods_supported` | RFC 8414 optional | Worth including `none` for public clients |
| `authorization_response_iss_parameter_supported` | MUST be `true` if `iss` is emitted | |

Well-known location (RFC 8414 s3, DISC): MCP uses the default `oauth-authorization-server` suffix only. Clients try, in order:

- Issuer with a path (`https://auth.example.com/tenant1`): `/.well-known/oauth-authorization-server/tenant1`, then `/.well-known/openid-configuration/tenant1`, then `/tenant1/.well-known/openid-configuration`.
- Issuer without a path: `/.well-known/oauth-authorization-server`, then `/.well-known/openid-configuration`.

Serving only the RFC 8414 URL is enough (the AS MUST provide one of the two mechanisms; clients MUST support both).

### 4.3 Client registration

| Mechanism | AS | Client | Source |
| --- | --- | --- | --- |
| Client ID Metadata Documents | SHOULD support | SHOULD support | AUTH Overview 2; REG |
| Pre-registration | not stated for the AS | SHOULD support static credentials | REG Pre-registration |
| Dynamic Client Registration (RFC 7591) | MAY (deprecated) | MAY | AUTH Overview 3; REG; CHANGELOG Deprecated 4 |

Clients MUST obtain a client ID by one of the three before the flow (AUTH Client Registration). Client priority order (SHOULD): pre-registered, then CIMD if `client_id_metadata_document_supported`, then DCR if `registration_endpoint`, then ask the user (REG).

CIMD requirements on the AS (REG; CIMD):

- Fetch the document when `client_id` is a URL (SHOULD).
- The document's `client_id` MUST match the URL exactly (simple string comparison, RFC 3986 s6.2.1).
- Validate it is JSON with required fields: `client_id`, `client_name`, `redirect_uris` (MUST).
- Validate the request's `redirect_uri` is an exact match of a listed one (MUST).
- Reject `client_secret` and shared-secret `token_endpoint_auth_method` values (`client_secret_post`, `client_secret_basic`, `client_secret_jwt`) (MUST NOT accept). `private_key_jwt` is allowed for clients; `none` for public clients.
- `client_id` URL: https, path component present, no fragment, no credentials, no dot segments, SHOULD NOT have a query (CIMD s3).
- Cache respecting HTTP cache headers (SHOULD); MUST NOT cache errors or invalid documents.
- Abort the authorization request if the fetch fails (SHOULD).
- SSRF: avoid fetching private or loopback addresses, limit response size (draft suggests 5 KB), consider non-HTTP schemes (SHOULD); prefetch and cache `logo_uri` rather than hotlink (SHOULD).
- Consent page: MUST clearly display the redirect URI hostname; SHOULD show the `client_id` hostname and add a warning for `localhost`-only redirect URIs; domain trust policies are MAY.
- The document fetch is an outbound request triggered by an unauthenticated visitor: it is the main abuse surface (map "Not yet specified": limits on OAuth endpoints).

DCR requirements, if offered (REG): clients MUST send `application_type` (`native` for loopback and CLI, `web` for remote); the AS may reject by OIDC redirect URI rules. Registration needs no user interaction, so it is an unauthenticated write endpoint.

### 4.4 PKCE

- Clients MUST implement PKCE (OAuth 2.1 s7.5.2), MUST verify support through AS metadata, and MUST use `S256` when technically capable (SEC Authorization Code Protection).
- For the AS: publish `code_challenge_methods_supported`; OIDC-style discovery servers MUST include it too. The AS must in fact require and verify `code_verifier` (OAuth 2.1).

### 4.5 Resource indicators (RFC 8707)

The client MUST send `resource` in both the authorization and token requests, set to the canonical URI of the MCP server, and MUST send it even if the AS does not support it (AUTH Resource Parameter Implementation). The AS SHOULD audience-restrict the token to it. Since the RS MUST check audience, the Quack AS must store the requested `resource` on the Grant and put it in the token. It may require it and answer `invalid_target` for anything but Quack's MCP resource identifier. RFC 8707 allows multiple `resource` values; MCP uses one.

### 4.6 Refresh tokens

| Rule | Level | Source |
| --- | --- | --- |
| Client keeps refresh tokens confidential | MUST | AUTH Refresh Tokens |
| Client SHOULD list `refresh_token` in `grant_types` | SHOULD | AUTH Refresh Tokens |
| Client MAY add `offline_access` scope if in AS `scopes_supported` | MAY | AUTH Refresh Tokens |
| Client must not assume a refresh token is issued; the AS retains discretion | MUST NOT assume | AUTH Refresh Tokens |
| RS SHOULD NOT put `offline_access` in `WWW-Authenticate` scope or PRM `scopes_supported` | SHOULD NOT | AUTH Refresh Tokens |
| AS rotates refresh tokens for public clients | MUST | SEC Token Theft |

Issuing refresh tokens at all is the AS's choice (open for Quack). If issued to public clients (CIMD clients use `token_endpoint_auth_method: none`), rotation is mandatory. A revoked Grant must kill its refresh token.

## 5. Flow, as Quack sees it

1. Client POSTs to the MCP endpoint without a token. RS answers `401` with `WWW-Authenticate: Bearer resource_metadata="..."` and optional `scope`.
2. Client GETs the PRM, reads `authorization_servers`, fetches AS metadata (RFC 8414 first), records `issuer`.
3. Client picks a registration path (CIMD preferred) and checks `code_challenge_methods_supported`.
4. Client opens the browser at `authorization_endpoint` with `client_id`, `redirect_uri`, `code_challenge` (S256), `resource`, `scope`, `state`.
5. User signs in (Session cookie) and consents on the web app; the AS redirects with `code`, `state`, `iss`.
6. Client validates `iss` (RFC 9207 table in AUTH), POSTs to `token_endpoint` with `code_verifier` and `resource`.
7. Client calls the MCP endpoint with `Authorization: Bearer`. A call needing a Permission outside the Grant gets 403 `insufficient_scope`, and the client re-runs steps 4 to 6 with the union of scopes.

## 6. Domain mapping (decisions the spec forces or leaves open)

Forced:

- A Grant must record: User, the client identity (CIMD URL or DCR id), granted scopes (Permissions), the `resource` audience, redirect URI, and refresh state if any. The audience check and the scope check read from it.
- Tokens must be audience-bound to the MCP resource identifier; a token must not be usable on other `/api` endpoints. The MCP resource must not accept the Session cookie, and the existing cookie `Authentication` must not accept an OAuth access token (MUST NOT accept tokens meant for other resources).
- Insufficient Permission on a tool call is `403` with `error="insufficient_scope"`, `scope` listing every missing Permission at once, and `resource_metadata`. Permissions as scope names (`todos:list`, ...) fit; there are no hierarchies today.
- 401 for missing, malformed, expired or revoked tokens (revocation looks like invalid).
- PRM `scopes_supported` should be the minimal basic set, not every Permission (AUTH). Candidate: `todos:list`; the others arrive by step-up.
- The AS MUST advertise `S256`, and SHOULD advertise `client_id_metadata_document_supported` and `iss` support.
- The consent page MUST show the redirect URI hostname; it SHOULD show `client_name` and warn for localhost-only redirects.
- Origin validation on the MCP endpoint is MUST. Non-browser AI Clients usually send no `Origin`, which is allowed; a present, unexpected one must get 403. The relay must forward `Origin`.

Left open by the spec:

- Whether to support CIMD only, or also DCR (deprecated, MAY) and pre-registration. CIMD alone is spec-conforming: the AS SHOULD, DCR is MAY. A client that only does DCR will fail against a CIMD-only AS; the spec does not say which clients exist in practice.
- Access token format (opaque vs JWT) and lifetime; the spec says only "short-lived" and "validate per OAuth 2.1 s5.2".
- Whether to issue refresh tokens, and their lifetime.
- Revocation and introspection endpoints (RFC 7009, 7662): not required by MCP.
- What happens to open `subscriptions/listen` streams when a Grant is revoked.
- CORS on PRM and AS metadata for browser-based clients: the spec and RFC 9728 are silent. AGENTS.md says the server has no CORS policy.
- Abuse limits for the token, registration and CIMD-fetch paths.

## 7. Streamable HTTP and auth in one place

- Every request is a separate POST to one endpoint; there is no session ID, so nothing to bind a token to beyond the `Authorization` header.
- `Mcp-Method` and `Mcp-Name` headers exist for intermediaries (the relay can route and rate-limit on them) and are validated against the body by whichever component reads the body.
- GET, DELETE: 405. `Mcp-Session-Id`, `Last-Event-ID`: ignored.
- Per map #52, Effect 4.1.4's `effect/ai/McpServer` already speaks `2026-07-28`. The spec leaves authorization outside the transport, so the PRM, AS metadata and bearer validation are Quack's to build (not verified against Effect's source in this note).

## 8. Path constraints for one public origin

Assume origin `https://quack.example` and an MCP endpoint under the server's `/api` prefix, for instance `https://quack.example/api/mcp`.

- Resource identifier = the URL clients use: `https://quack.example/api/mcp` (or the bare origin `https://quack.example`; both are valid forms, pick one and use it everywhere: PRM `resource`, `resource` parameter, token audience).
- PRM at the endpoint path: `https://quack.example/.well-known/oauth-protected-resource/api/mcp`. Root alternative: `https://quack.example/.well-known/oauth-protected-resource` (the root document describes one resource, whose identifier must equal the MCP resource identifier; fine if there is a single MCP endpoint).
- AS issuer `https://quack.example` (no path): metadata at `https://quack.example/.well-known/oauth-authorization-server`. An issuer with a path such as `https://quack.example/api` would instead give `https://quack.example/.well-known/oauth-authorization-server/api` (and clients then also try the OIDC variants). The issuer string is compared exactly and keys client credentials, so it is effectively permanent.
- `/.well-known/*` sits outside `/api`. AGENTS.md says the server serves everything under `/api` and the relay forwards `/api/*` only. Quack therefore needs web-app routes (or a second relay rule) for `/.well-known/oauth-protected-resource*` and `/.well-known/oauth-authorization-server*`, passing the response unchanged. Putting these documents elsewhere is not an option: URL construction is fixed.
- The PRM location is free in practice, because `resource_metadata` in `WWW-Authenticate` gives it. The AS metadata location is not: it is derived from the issuer.
- `authorization_endpoint` is a browser page on the web app origin (sign-in and consent live there); `token_endpoint` (and `registration_endpoint` if any) are API endpoints, naturally under `/api/...`. MCP imposes no path convention on them. All must be HTTPS (portless dev uses `https://*.quack.localhost`; client redirect URIs are loopback or HTTPS).
- The relay must preserve `Authorization`, `WWW-Authenticate`, `Origin`, `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name`, and SSE streaming (no buffering; the server SHOULD send `X-Accel-Buffering: no`). The relay also rewrites `X-Forwarded-For`; that header feeds `AttemptLimiter`.
- The issuer, resource identifier and `iss` value are computed from the public origin, not from the internal `API_URL`. The server needs a configured public base URL (a `ServerConfig` variable) to produce them behind the relay.

## 9. Citations to RFCs

- RFC 9728 (PRM): s2 fields (`resource` required), s3.1 URL construction, s3.2 response, s3.3 `resource` validation, s5.1 `WWW-Authenticate` `resource_metadata`, s7.4 audience restriction.
- RFC 8414 (AS metadata): s2 fields (`issuer`, `response_types_supported`, endpoints), s3 URL construction with path insertion, s3.3 issuer validation, s5 OIDC compatibility.
- RFC 8707 (resource indicators): s2 `resource` parameter (absolute URI, no fragment), s2.1 authorization request, s2.2 token request, `invalid_target`, audience restriction.
- RFC 7591 (DCR): retained only for compatibility (MAY, deprecated).
- RFC 9207: `iss` authorization response parameter, s2.4 client check.
- RFC 6750 s3, s3.1: `WWW-Authenticate` Bearer parameters, `insufficient_scope`.
- OAuth 2.1 draft-13: s1.5 communication security, s4.1.1 S256, s4.3 and s4.3.1 refresh tokens, s5 resource requests, s5.2 token validation, s5.3 errors, s7.5.2 PKCE, s7.12.2 redirects.
- Client ID Metadata Documents draft-00: s3 `client_id` URL, s4 discovery, s4.1 metadata, s4.4 caching, s4.5 redirect URIs, s5 AS metadata, s6 security.
