import { Forbidden } from "@quack/contracts/identity/identity-errors";
import type { Role } from "@quack/contracts/identity/user";
import { UsersPage, type UsersPageQuery } from "@quack/contracts/users/users-api";
import { Context, Effect, Layer } from "effect";

import { UserRepository } from "#/modules/identity/domain/user-repository.ts";

export class Users extends Context.Service<
  Users,
  {
    list(role: Role, query: UsersPageQuery): Effect.Effect<UsersPage, Forbidden>;
  }
>()("@quack/server/identity/Users") {
  static readonly layer = Layer.effect(
    Users,
    Effect.gen(function* () {
      const repository = yield* UserRepository;

      return Users.of({
        list: Effect.fn("Users.list")(function* (role, { page, pageSize }) {
          if (role !== "admin") {
            return yield* new Forbidden();
          }
          const found = yield* repository.findPage({
            offset: (page - 1) * pageSize,
            limit: pageSize,
          });
          return new UsersPage(found);
        }),
      });
    }),
  );
}
