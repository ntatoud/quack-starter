import { Unauthenticated } from "@quack/contracts/identity/identity-errors";
import type { Profile } from "@quack/contracts/identity/profile";
import { User, type UserId } from "@quack/contracts/identity/user";
import {
  CannotChangeOwnAccess,
  CannotDeleteSelf,
  UserInvited,
  UserNotFound,
} from "@quack/contracts/users/user-errors";
import { type UserChanges, UserList, type UserListQuery } from "@quack/contracts/users/users-api";
import { Context, Effect, Layer, Option } from "effect";

import { canChangeStatus, withProfile } from "#/modules/identity/domain/user.ts";
import { UserRepository } from "#/modules/identity/domain/user-repository.ts";

export class Users extends Context.Service<
  Users,
  {
    list(query: UserListQuery): Effect.Effect<UserList>;
    get(id: UserId): Effect.Effect<User, UserNotFound>;
    /** `by` is the Admin who asks. */
    update(
      id: UserId,
      changes: UserChanges,
      by: UserId,
    ): Effect.Effect<User, UserNotFound | CannotChangeOwnAccess | UserInvited>;
    /** `by` is the Admin who asks. */
    remove(id: UserId, by: UserId): Effect.Effect<void, UserNotFound | CannotDeleteSelf>;
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
        update: Effect.fn("Users.update")(function* (id, changes, by) {
          if (id === by) return yield* new CannotChangeOwnAccess();
          const found = yield* repository.findById(id);
          if (Option.isNone(found)) return yield* new UserNotFound({ id });
          if (changes.status !== undefined && !canChangeStatus(found.value)) {
            return yield* new UserInvited({ id });
          }
          const user = new User({ ...found.value, ...changes });
          yield* repository.update(user);
          return user;
        }),
        remove: Effect.fn("Users.remove")(function* (id, by) {
          if (id === by) return yield* new CannotDeleteSelf();
          const removed = yield* repository.remove(id);
          if (!removed) return yield* new UserNotFound({ id });
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
