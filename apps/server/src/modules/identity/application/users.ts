import { Unauthenticated } from "@quack/contracts/identity/identity-errors";
import type { Profile } from "@quack/contracts/identity/profile";
import { type TimeZone, User, type UserId } from "@quack/contracts/identity/user";
import {
  CannotChangeOwnAccess,
  CannotDeleteSelf,
  UserInvited,
  UserNotFound,
} from "@quack/contracts/users/user-errors";
import { type UserChanges, UserList, type UserListQuery } from "@quack/contracts/users/users-api";
import { Context, Effect, Layer, Option } from "effect";

import { withProfile, withTimeZone } from "#/modules/identity/domain/user.ts";
import { statusSetByAdmin } from "#/modules/identity/domain/user-status.ts";
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
    updateTimeZone(id: UserId, timeZone: TimeZone): Effect.Effect<User, Unauthenticated>;
  }
>()("@quack/server/identity/Users") {
  static readonly layer = Layer.effect(
    Users,
    Effect.gen(function* () {
      const repository = yield* UserRepository;

      // Read again rather than taken from the Current User: the write must not bring back what changed since the
      // request was authenticated.
      const amendCurrentUser = Effect.fn("Users.amendCurrentUser")(function* (
        id: UserId,
        change: (user: User) => User,
      ) {
        const found = yield* repository.findById(id);

        if (Option.isNone(found)) {
          return yield* new Unauthenticated();
        }

        const user = change(found.value);
        yield* repository.update(user);

        return user;
      });

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

          const withStatus =
            changes.status === undefined
              ? Option.some(found.value)
              : statusSetByAdmin(found.value, changes.status);

          if (Option.isNone(withStatus)) return yield* new UserInvited({ id });

          const user = new User({ ...withStatus.value, role: changes.role ?? found.value.role });
          yield* repository.update(user);

          return user;
        }),
        remove: Effect.fn("Users.remove")(function* (id, by) {
          if (id === by) return yield* new CannotDeleteSelf();
          const removed = yield* repository.remove(id);

          if (!removed) return yield* new UserNotFound({ id });
        }),
        updateProfile: Effect.fn("Users.updateProfile")((id, profile) =>
          amendCurrentUser(id, (user) => withProfile(user, profile)),
        ),
        updateTimeZone: Effect.fn("Users.updateTimeZone")((id, timeZone) =>
          amendCurrentUser(id, (user) => withTimeZone(user, timeZone)),
        ),
      });
    }),
  );
}
