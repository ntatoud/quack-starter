import { Api } from "@quack/contracts/api";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { Identity } from "#/modules/identity/application/identity.ts";

export const IdentityHandlers = HttpApiBuilder.group(
  Api,
  "identity",
  Effect.fn(function* (handlers) {
    const identity = yield* Identity;

    return handlers.handleAll({
      signUp: ({ payload }) => identity.signUp(payload.email, payload.password),
    });
  }),
);
