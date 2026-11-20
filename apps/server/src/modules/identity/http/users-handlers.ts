import { Api } from "@quack/contracts/api";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { Users } from "#/modules/identity/application/users.ts";

export const UsersHandlers = HttpApiBuilder.group(
  Api,
  "users",
  Effect.fn(function* (handlers) {
    const users = yield* Users;

    return handlers.handleAll({
      list: ({ query }) => users.list(query),
      get: ({ params }) => users.get(params.id),
    });
  }),
);
