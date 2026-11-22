import { Unauthenticated } from "@quack/contracts/identity/identity-errors";
import type { OnboardingPayload } from "@quack/contracts/identity/identity-api";
import type { User, UserId } from "@quack/contracts/identity/user";
import { Context, DateTime, Effect, Layer, Option } from "effect";

import { onboarded } from "#/modules/identity/domain/user.ts";
import { UserRepository } from "#/modules/identity/domain/user-repository.ts";

export class Onboarding extends Context.Service<
  Onboarding,
  {
    complete(id: UserId, name: OnboardingPayload): Effect.Effect<User, Unauthenticated>;
  }
>()("@quack/server/identity/Onboarding") {
  static readonly layer = Layer.effect(
    Onboarding,
    Effect.gen(function* () {
      const repository = yield* UserRepository;

      return Onboarding.of({
        complete: Effect.fn("Onboarding.complete")(function* (id, name) {
          // Read again rather than taken from the Current User: the write must not bring back what changed since the request was authenticated.
          const found = yield* repository.findById(id);

          if (Option.isNone(found)) {
            return yield* new Unauthenticated();
          }

          const user = onboarded(found.value, name, yield* DateTime.now);
          yield* repository.update(user);

          return user;
        }),
      });
    }),
  );
}
