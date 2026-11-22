import { EmailAlreadyTaken } from "@quack/contracts/identity/identity-errors";
import { type Email, User, UserId } from "@quack/contracts/identity/user";
import type { UserOrder } from "@quack/contracts/users/users-api";
import { DateTime, Effect, Layer, Option } from "effect";

import { UserRepository } from "#/modules/identity/domain/user-repository.ts";

type SortKey = string | number | null;

const compare = (a: string | number, b: string | number) => (a < b ? -1 : a > b ? 1 : 0);

const millisOf = (date: DateTime.Utc | null) =>
  date === null ? null : DateTime.toEpochMillis(date);

const sortKeys: Record<UserOrder, (user: User) => SortKey> = {
  email: (user) => user.email,
  // The NUL sorts a last name before the same one followed by more letters, whatever the first name.
  name: ({ profile }) =>
    profile === null ? null : `${profile.lastName}\u0000${profile.firstName}`.toLowerCase(),
  role: (user) => user.role,
  status: (user) => user.status,
  team: (user) => user.profile?.team ?? null,
  country: (user) => user.profile?.country ?? null,
  createdAt: (user) => millisOf(user.createdAt),
  lastSignInAt: (user) => millisOf(user.lastSignInAt),
  onboardedAt: (user) => millisOf(user.onboardedAt),
};

const fullName = ({ profile }: User) =>
  profile === null ? "" : `${profile.firstName} ${profile.lastName}`.toLowerCase();

const keeps = <A>(wanted: A | undefined, value: A | undefined) =>
  wanted === undefined || value === wanted;

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
    update: (user) =>
      Effect.sync(() => {
        const stored = users.get(user.id);

        if (stored !== undefined) {
          users.set(user.id, { ...stored, user: new User({ ...user, email: stored.user.email }) });
        }
      }),
    remove: (id) =>
      Effect.sync(() => {
        const stored = users.get(id);

        if (stored === undefined) return false;
        idsByEmail.delete(stored.user.email);

        return users.delete(id);
      }),
    findById: (id) => Effect.sync(() => Option.fromNullishOr(users.get(id)?.user)),
    findByEmail: (email) =>
      Effect.sync(() =>
        Option.fromNullishOr(idsByEmail.get(email)).pipe(
          Option.flatMapNullishOr((id) => users.get(id)),
        ),
      ),
    findAll: ({ page, pageSize, orderBy, dir, search = "", status, role, team, onboarded }) =>
      Effect.sync(() => {
        const offset = (page - 1) * pageSize;
        const sign = dir === "asc" ? 1 : -1;
        const keyOf = sortKeys[orderBy];

        const sorted = Array.from(users.values(), ({ user }) => user)
          .filter(
            (user) =>
              (user.email.includes(search) || fullName(user).includes(search)) &&
              keeps(status, user.status) &&
              keeps(role, user.role) &&
              keeps(team, user.profile?.team) &&
              keeps(onboarded, user.onboardedAt !== null),
          )
          .map((user) => ({ user, key: keyOf(user) }))
          .toSorted(
            (a, b) =>
              (a.key === null || b.key === null
                ? Number(a.key === null) - Number(b.key === null)
                : sign * compare(a.key, b.key)) || compare(a.user.email, b.user.email),
          )
          .map(({ user }) => user);

        return { items: sorted.slice(offset, offset + pageSize), total: sorted.length };
      }),
  });
});
