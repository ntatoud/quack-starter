import { base, en, Faker } from "@faker-js/faker";
import { Email, Password, type Role, User } from "@quack/contracts/identity/user";
import { Effect, Layer, Schema } from "effect";

import { PasswordHasher } from "#/modules/identity/domain/password-hasher.ts";
import { UserRepository } from "#/modules/identity/domain/user-repository.ts";

export interface SeedUser {
  readonly email: Email;
  readonly password: Password;
  readonly role: Role;
}

const seedPassword = "quack-password";

const randomEmails = (count: number) => {
  const faker = new Faker({ locale: [en, base] });
  // A fixed seed gives the same Users at every start, so an email noted once keeps working.
  faker.seed(1);
  return faker.helpers.uniqueArray(() => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    return faker.internet.email({ firstName, lastName }).toLowerCase();
  }, count);
};

const seedUser = (email: string, role: Role): SeedUser => ({
  email: Schema.decodeSync(Email)(email),
  password: Schema.decodeSync(Password)(seedPassword),
  role,
});

export const devUsers: ReadonlyArray<SeedUser> = [
  seedUser("admin@quack.dev", "admin"),
  ...["user@quack.dev", ...randomEmails(100)].map((email) => seedUser(email, "user")),
];

export const UserSeed = (seeds: ReadonlyArray<SeedUser>) =>
  Layer.effectDiscard(
    Effect.gen(function* () {
      const users = yield* UserRepository;
      const hasher = yield* PasswordHasher;
      yield* Effect.forEach(
        seeds,
        Effect.fn("UserSeed.create")(function* ({ email, password, role }) {
          const user = new User({ id: yield* users.nextId, email, role });
          yield* users
            .create(user, yield* hasher.hash(password))
            .pipe(Effect.catchTag("EmailAlreadyTaken", () => Effect.void));
        }),
        { concurrency: "unbounded", discard: true },
      );
      yield* Effect.logInfo(`Seeded ${seeds.length} Users`).pipe(
        Effect.annotateLogs({
          first: seeds.slice(0, 3).map(({ email }) => email),
          password: seedPassword,
        }),
      );
    }),
  );
