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
      list: Effect.fn(function* ({ query }) {
        const { role } = yield* CurrentUser;
        return yield* users.list(role, query);
      }),
    });
  }),
);
