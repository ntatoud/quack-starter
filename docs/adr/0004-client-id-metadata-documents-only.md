# 0004: AI Clients identify themselves by Client ID Metadata Documents only

Accepted, 2026-11-22. Decided in [#57](https://github.com/ntatoud/quack-starter/issues/57); built in [#175](https://github.com/ntatoud/quack-starter/issues/175).

## Context

The MCP authorization spec (`2026-07-28`) names two ways for an AI Client to tell an authorization server who it is: a Client ID Metadata Document (SHOULD), whose URL is the `client_id`, and Dynamic Client Registration (deprecated, MAY), an unauthenticated endpoint that writes a client on request.

## Decision

- Quack supports Client ID Metadata Documents only. The document's URL is the AI Client, one for every User: it is what a Grant is given to.
- Quack fetches the document when a signed-in User checks an authorization request, over https only (http on loopback when `AI_CLIENT_LOOPBACK_HTTP` is on, for a local MCP Inspector), following no redirect, refusing private, loopback, and special-use addresses after its own DNS lookup, and caching it as `Cache-Control` says.
- A redirect URI must be one the document lists; on loopback, on any port (RFC 8252 s7.3).
- No Dynamic Client Registration endpoint.

## Consequences

- No table of clients, no unauthenticated write endpoint, nothing to clean up.
- An AI Client that only does Dynamic Client Registration cannot connect: Cursor, today.
- The consent page can show only the document's host as verified; its `client_name` is what the AI Client says of itself.
