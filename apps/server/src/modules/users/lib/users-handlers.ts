import { Api } from "@quack/contracts/api";
import { CurrentUser } from "@quack/contracts/identity/authentication";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { Users } from "#/modules/users/lib/users.ts";

export const UsersHandlers = HttpApiBuilder.group(
  Api,
  "users",
  Effect.fn(function* (handlers) {
    const users = yield* Users;
    const currentUser = Effect.map(CurrentUser, ({ id }) => id);

    return handlers.handleAll({
      list: ({ query }) => users.list(query),
      get: ({ params }) => users.get(params.id),
      update: ({ params, payload }) =>
        Effect.flatMap(currentUser, (by) => users.update(params.id, payload, by)),
      remove: ({ params }) => Effect.flatMap(currentUser, (by) => users.remove(params.id, by)),
      updateProfile: ({ payload }) =>
        Effect.flatMap(currentUser, (id) => users.updateProfile(id, payload)),
      updateTimeZone: ({ payload }) =>
        Effect.flatMap(currentUser, (id) => users.updateTimeZone(id, payload.timeZone)),
      completeOnboarding: ({ payload }) =>
        Effect.flatMap(currentUser, (id) => users.completeOnboarding(id, payload)),
    });
  }),
);
