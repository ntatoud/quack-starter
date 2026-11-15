import { EmailAlreadyTaken } from "@quack/contracts/identity/identity-errors";
import { type Email, type User, UserId } from "@quack/contracts/identity/user";
import { Effect, Layer, Option } from "effect";

import { UserRepository } from "#/modules/identity/domain/user-repository.ts";

export const UserRepositoryMemory = Layer.sync(UserRepository, () => {
  const users = new Map<UserId, { readonly user: User; readonly passwordHash: string }>();
  // An `Email` is already trimmed and lowercased, so it is its own unique key.
  const idsByEmail = new Map<Email, UserId>();

  return UserRepository.of({
    nextId: Effect.sync(() => UserId.make(crypto.randomUUID())),
    create: (user, passwordHash) =>
      Effect.suspend(() => {
        if (idsByEmail.has(user.email)) return Effect.fail(new EmailAlreadyTaken());
        idsByEmail.set(user.email, user.id);
        users.set(user.id, { user, passwordHash });
        return Effect.void;
      }),
    findById: (id) => Effect.sync(() => Option.fromNullishOr(users.get(id)?.user)),
    findByEmail: (email) =>
      Effect.sync(() =>
        Option.fromNullishOr(idsByEmail.get(email)).pipe(
          Option.flatMapNullishOr((id) => users.get(id)),
        ),
      ),
    findAll: ({ page, pageSize }) =>
      Effect.sync(() => {
        const offset = (page - 1) * pageSize;
        const sorted = Array.from(users.values(), ({ user }) => user).toSorted((a, b) =>
          a.email < b.email ? -1 : a.email > b.email ? 1 : 0,
        );
        return { items: sorted.slice(offset, offset + pageSize), total: sorted.length };
      }),
  });
});
