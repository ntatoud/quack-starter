import { base, en, Faker } from "@faker-js/faker";
import { devAccounts, devPassword } from "@quack/contracts/identity/dev-accounts";
import { Email, Password, type Role, User, type UserStatus } from "@quack/contracts/identity/user";
import { DateTime, Effect, Layer, Schema } from "effect";

import { PasswordHasher } from "#/modules/identity/domain/password-hasher.ts";
import { UserRepository } from "#/modules/identity/domain/user-repository.ts";

export interface SeedUser extends Omit<ConstructorParameters<typeof User>[0], "id"> {
  readonly password: Password;
}

const dayMillis = 24 * 60 * 60 * 1000;

const devAccount = (email: string, role: Role, now: Date): SeedUser => ({
  email: Schema.decodeSync(Email)(email),
  password: Schema.decodeSync(Password)(devPassword),
  role,
  status: "active",
  createdAt: DateTime.fromDateUnsafe(new Date(now.getTime() - 400 * dayMillis)),
  lastSignInAt: DateTime.fromDateUnsafe(new Date(now.getTime() - dayMillis)),
  emailVerifiedAt: DateTime.fromDateUnsafe(new Date(now.getTime() - 400 * dayMillis)),
});

/** Spread over the two years before `now`, with as many Users and dates at every start for the same `now`. */
const randomUsers = (count: number, now: Date): ReadonlyArray<SeedUser> => {
  const faker = new Faker({ locale: [en, base] });
  // A fixed seed gives the same Users at every start, so an email noted once keeps working.
  faker.seed(1);
  const emails = new Set<string>();
  const users: Array<SeedUser> = [];
  while (users.length < count) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet.email({ firstName, lastName }).toLowerCase();
    if (emails.has(email)) continue;
    emails.add(email);
    const status = faker.helpers.weightedArrayElement<UserStatus>([
      { weight: 80, value: "active" },
      { weight: 12, value: "invited" },
      { weight: 8, value: "suspended" },
    ]);
    const createdAt = faker.date.past({ years: 2, refDate: now });
    users.push({
      email: Schema.decodeSync(Email)(email),
      password: Schema.decodeSync(Password)(devPassword),
      role: "user",
      status,
      createdAt: DateTime.fromDateUnsafe(createdAt),
      lastSignInAt:
        status === "invited"
          ? null
          : DateTime.fromDateUnsafe(faker.date.between({ from: createdAt, to: now })),
      emailVerifiedAt:
        status === "invited" || faker.datatype.boolean({ probability: 0.15 })
          ? null
          : DateTime.fromDateUnsafe(
              new Date(createdAt.getTime() + faker.number.int({ min: 60_000, max: dayMillis })),
            ),
    });
  }
  return users;
};

export const devUsers = (now: Date): ReadonlyArray<SeedUser> => [
  devAccount(devAccounts.admin, "admin", now),
  devAccount(devAccounts.user, "user", now),
  ...randomUsers(100, now),
];

export const UserSeed = (seeds: ReadonlyArray<SeedUser>) =>
  Layer.effectDiscard(
    Effect.gen(function* () {
      const users = yield* UserRepository;
      const hasher = yield* PasswordHasher;
      yield* Effect.forEach(
        seeds,
        Effect.fn("UserSeed.create")(function* ({ password, ...fields }) {
          const user = new User({ id: yield* users.nextId, ...fields });
          yield* users
            .create(user, yield* hasher.hash(password))
            .pipe(Effect.catchTag("EmailAlreadyTaken", () => Effect.void));
        }),
        { concurrency: "unbounded", discard: true },
      );
      yield* Effect.logInfo(`Seeded ${seeds.length} Users`).pipe(
        Effect.annotateLogs({
          first: seeds.slice(0, 3).map(({ email }) => email),
          password: devPassword,
        }),
      );
    }),
  );
