import type { PageQuery } from "@quack/contracts/pagination/page";
import { UsersPage } from "@quack/contracts/users/users-api";
import { Context, Effect, Layer } from "effect";

import { UserRepository } from "#/modules/identity/domain/user-repository.ts";

export class Users extends Context.Service<
  Users,
  {
    list(query: PageQuery): Effect.Effect<UsersPage>;
  }
>()("@quack/server/identity/Users") {
  static readonly layer = Layer.effect(
    Users,
    Effect.gen(function* () {
      const repository = yield* UserRepository;

      return Users.of({
        list: Effect.fn("Users.list")(function* (query) {
          return new UsersPage(yield* repository.findAll(query));
        }),
      });
    }),
  );
}
