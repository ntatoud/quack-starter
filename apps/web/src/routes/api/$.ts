import { API_PREFIX } from "@quack/contracts/api";
import { createFileRoute } from "@tanstack/react-router";

import { relayUnder } from "#/lib/api-relay-route.ts";

export const Route = createFileRoute("/api/$")({
  server: { handlers: { ANY: relayUnder(API_PREFIX) } },
});
