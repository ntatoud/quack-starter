import { createFileRoute } from "@tanstack/react-router";

import { relayUnder } from "#/lib/api-relay-route.ts";

// The OAuth metadata documents, which AI Clients look for at the root of the origin, outside /api.
export const Route = createFileRoute("/.well-known/$")({
  server: { handlers: { ANY: relayUnder("/.well-known") } },
});
