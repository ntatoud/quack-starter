import { base, en, Faker } from "@faker-js/faker";
import { devAccounts, devPassword } from "@quack/contracts/identity/dev-accounts";
import { Email, Password, type Role, User, type UserStatus } from "@quack/contracts/identity/user";
import { Effect, Layer, Schema } from "effect";

import { PasswordHasher } from "#/modules/identity/domain/password-hasher.ts";
import { UserRepository } from "#/modules/identity/domain/user-repository.ts";

export interface SeedUser extends Omit<ConstructorParameters<typeof User>[0], "id"> {
  readonly password: Password;
}

const devAccount = (email: string, role: Role): SeedUser => ({
  email: Schema.decodeSync(Email)(email),
  password: Schema.decodeSync(Password)(devPassword),
  role,
  status: "active",
});

const randomUsers = (count: number): ReadonlyArray<SeedUser> => {
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
    users.push({
      email: Schema.decodeSync(Email)(email),
      password: Schema.decodeSync(Password)(devPassword),
      role: "user",
      status: faker.helpers.weightedArrayElement<UserStatus>([
        { weight: 80, value: "active" },
        { weight: 12, value: "invited" },
        { weight: 8, value: "suspended" },
      ]),
    });
  }
  return users;
};

export const devUsers: ReadonlyArray<SeedUser> = [
  devAccount(devAccounts.admin, "admin"),
  devAccount(devAccounts.user, "user"),
  ...randomUsers(100),
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
