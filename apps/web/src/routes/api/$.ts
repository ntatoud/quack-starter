import { API_PREFIX } from "@quack/contracts/api";
import { createFileRoute } from "@tanstack/react-router";
import { getRequestIP } from "@tanstack/react-start/server";

import { ApiRelayHandler } from "#/lib/api-relay.ts";
import { serverEnv } from "#/lib/env.server.ts";

const handler = new ApiRelayHandler({ url: serverEnv.API_URL });

/** Every request under /api goes to the API, in dev and in production: see `ApiRelayHandler`. */
export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      ANY: async ({ request }) => {
        const { response } = await handler.handle(request, {
          prefix: API_PREFIX,
          context: { clientIp: getRequestIP() },
        });

        return response ?? new Response("Not Found", { status: 404 });
      },
    },
  },
});
