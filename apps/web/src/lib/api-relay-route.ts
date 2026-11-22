import { getRequestIP } from "@tanstack/react-start/server";

import { ApiRelayHandler } from "#/lib/api-relay.ts";
import { serverEnv } from "#/env/server.ts";

const handler = new ApiRelayHandler({ url: serverEnv.API_URL });

/** The server handler of a route that relays every request under `prefix` to the API. */
export const relayUnder =
  (prefix: `/${string}`) =>
  async ({ request }: { readonly request: Request }) => {
    const { response } = await handler.handle(request, {
      prefix,
      context: { clientIp: getRequestIP() },
    });

    return response ?? new Response("Not Found", { status: 404 });
  };
