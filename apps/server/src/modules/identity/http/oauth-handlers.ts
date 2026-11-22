import { Api } from "@quack/contracts/api";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { AuthorizationRequests } from "#/modules/identity/application/authorization-requests.ts";

export const OAuthHandlers = HttpApiBuilder.group(
  Api,
  "oauth",
  Effect.fn(function* (handlers) {
    const requests = yield* AuthorizationRequests;

    return handlers.handleAll({
      checkAuthorization: ({ payload }) => requests.check(payload),
    });
  }),
);
