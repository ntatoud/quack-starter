import { EmailAlreadyTaken } from "@quack/contracts/identity/identity-errors";
import { type Email, type User, UserId } from "@quack/contracts/identity/user";
import { Effect, Layer, Option } from "effect";

import { UserRepository } from "#/modules/identity/domain/user-repository.ts";

export const UserRepositoryMemory = Layer.sync(UserRepository, () => {
  const users = new Map<UserId, { readonly user: User; readonly passwordHash: string }>();
  // An `Email` is already trimmed and lowercased, so it is its own unique key.
  const emails = new Set<Email>();

  return UserRepository.of({
    nextId: Effect.sync(() => UserId.make(crypto.randomUUID())),
    create: (user, passwordHash) =>
      Effect.suspend(() => {
        if (emails.has(user.email)) return Effect.fail(new EmailAlreadyTaken());
        emails.add(user.email);
        users.set(user.id, { user, passwordHash });
        return Effect.void;
      }),
    findById: (id) => Effect.sync(() => Option.fromNullishOr(users.get(id)?.user)),
  });
});
