import { createFileRoute } from "@tanstack/react-router";
import { getRequestIP } from "@tanstack/react-start/server";

import { relayToApi } from "#/lib/api-relay.ts";
import { serverEnv } from "#/lib/env.server.ts";

/** Every request under /api goes to the API, in dev and in production: see `relayToApi`. */
export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      ANY: ({ request }) =>
        relayToApi(request, { apiUrl: serverEnv.API_URL, clientIp: getRequestIP() }),
    },
  },
});
