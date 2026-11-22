import { Api } from "@quack/contracts/api";
import { CurrentUser } from "@quack/contracts/identity/authentication";
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
      update: Effect.fn(function* ({ params, payload }) {
        const currentUser = yield* CurrentUser;

        return yield* users.update(params.id, payload, currentUser.id);
      }),
      remove: Effect.fn(function* ({ params }) {
        const currentUser = yield* CurrentUser;
        yield* users.remove(params.id, currentUser.id);
      }),
    });
  }),
);
