import type { PaginationQuery } from "@quack/contracts/pagination/paginated";
import { UserList } from "@quack/contracts/users/users-api";
import { Context, Effect, Layer } from "effect";

import { UserRepository } from "#/modules/identity/domain/user-repository.ts";

export class Users extends Context.Service<
  Users,
  {
    list(query: PaginationQuery): Effect.Effect<UserList>;
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
      });
    }),
  );
}
