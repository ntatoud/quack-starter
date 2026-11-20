import { Unauthenticated } from "@quack/contracts/identity/identity-errors";
import type { Profile } from "@quack/contracts/identity/profile";
import type { User, UserId } from "@quack/contracts/identity/user";
import { UserNotFound } from "@quack/contracts/users/user-errors";
import { UserList, type UserListQuery } from "@quack/contracts/users/users-api";
import { Context, Effect, Layer, Option } from "effect";

import { withProfile } from "#/modules/identity/domain/user.ts";
import { UserRepository } from "#/modules/identity/domain/user-repository.ts";

export class Users extends Context.Service<
  Users,
  {
    list(query: UserListQuery): Effect.Effect<UserList>;
    get(id: UserId): Effect.Effect<User, UserNotFound>;
    updateProfile(id: UserId, profile: Profile): Effect.Effect<User, Unauthenticated>;
  }
>()("@quack/server/identity/Users") {
  static readonly layer = Layer.effect(
    Users,
    Effect.gen(function* () {
      const repository = yield* UserRepository;

      return Users.of({
        list: Effect.fn("Users.list")(function* (query) {
          return new UserList(yield* repository.findAll(query));
        }),
        get: Effect.fn("Users.get")(function* (id) {
          const found = yield* repository.findById(id);
          if (Option.isNone(found)) {
            return yield* new UserNotFound({ id });
          }
          return found.value;
        }),
        updateProfile: Effect.fn("Users.updateProfile")(function* (id, profile) {
          // Read again rather than taken from the Current User: the write must not bring back what changed since the request was authenticated.
          const found = yield* repository.findById(id);
          if (Option.isNone(found)) {
            return yield* new Unauthenticated();
          }
          const user = withProfile(found.value, profile);
          yield* repository.update(user);
          return user;
        }),
      });
    }),
  );
}
