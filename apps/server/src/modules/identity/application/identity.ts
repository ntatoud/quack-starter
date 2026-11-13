import type { EmailAlreadyTaken } from "@quack/contracts/identity/identity-errors";
import { type Email, type Password, User } from "@quack/contracts/identity/user";
import { Context, Effect, Layer } from "effect";

import { PasswordHasher } from "#/modules/identity/domain/password-hasher.ts";
import { UserRepository } from "#/modules/identity/domain/user-repository.ts";

/** Use cases of the identity context. Depends on the domain only. */
export class Identity extends Context.Service<
  Identity,
  {
    /** Creates the User, with their password hashed. */
    signUp(email: Email, password: Password): Effect.Effect<User, EmailAlreadyTaken>;
  }
>()("@quack/server/identity/Identity") {
  static readonly layer = Layer.effect(
    Identity,
    Effect.gen(function* () {
      const users = yield* UserRepository;
      const hasher = yield* PasswordHasher;

      return Identity.of({
        signUp: Effect.fn("Identity.signUp")(function* (email, password) {
          const user = new User({ id: yield* users.nextId, email });
          yield* users.create(user, yield* hasher.hash(password));
          return user;
        }),
      });
    }),
  );
}
