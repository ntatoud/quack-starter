import { base, en, Faker } from "@faker-js/faker";
import { devAccounts, devPassword } from "@quack/contracts/identity/dev-accounts";
import { CountryCode, Profile, Team } from "@quack/contracts/identity/profile";
import { Email, type Role, User, UserId, type UserStatus } from "@quack/contracts/identity/user";
import { DateTime, Effect, Layer, Schema } from "effect";

import { UserRepository } from "#/modules/identity/domain/user-repository.ts";

/** Every seeded date is before it, so a seed gives the same Users whatever day it runs. */
export const seedDate = new Date("2026-06-01T00:00:00Z");

/** The argon2id hash of `devPassword`, computed once: hashing it for each of the 102 Users took seconds. */
export const devPasswordHash =
  "$argon2id$v=19$m=19456,t=2,p=1$KRL24AiOiRziOzszWPAFpA$0Zrm21ZkbUE8ObVN5MYqUcIG/xABGETqXdzX4X9v0Xs";

const tags = [
  "beta",
  "vip",
  "early-adopter",
  "mentor",
  "on-call",
  "remote",
  "part-time",
  "contractor",
];

const dayMillis = 24 * 60 * 60 * 1000;

const daysBeforeSeed = (days: number) =>
  DateTime.fromDateUnsafe(new Date(seedDate.getTime() - days * dayMillis));

const devAccount = (faker: Faker, email: string, role: Role, firstName: string): User =>
  new User({
    id: UserId.make(faker.string.uuid()),
    email: Schema.decodeSync(Email)(email),
    role,
    status: "active",
    createdAt: daysBeforeSeed(400),
    lastSignInAt: daysBeforeSeed(1),
    emailVerifiedAt: daysBeforeSeed(400),
    profile: new Profile({
      firstName,
      lastName: "Quack",
      avatarUrl: null,
      jobTitle: role === "admin" ? "Administrator" : "Member",
      team: "operations",
      country: CountryCode.make("FR"),
      tags: [],
    }),
  });

const randomUsers = (faker: Faker, count: number): ReadonlyArray<User> => {
  const emails = new Set<string>();
  const users: Array<User> = [];
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
    const createdAt = faker.date.past({ years: 2, refDate: seedDate });
    users.push(
      new User({
        id: UserId.make(faker.string.uuid()),
        email: Schema.decodeSync(Email)(email),
        role: "user",
        status,
        createdAt: DateTime.fromDateUnsafe(createdAt),
        lastSignInAt:
          status === "invited"
            ? null
            : DateTime.fromDateUnsafe(faker.date.between({ from: createdAt, to: seedDate })),
        emailVerifiedAt:
          status === "invited" || faker.datatype.boolean({ probability: 0.15 })
            ? null
            : DateTime.fromDateUnsafe(
                new Date(createdAt.getTime() + faker.number.int({ min: 60_000, max: dayMillis })),
              ),
        profile: faker.datatype.boolean({ probability: 0.1 })
          ? null
          : new Profile({
              firstName,
              lastName,
              avatarUrl: faker.datatype.boolean({ probability: 0.6 }) ? faker.image.avatar() : null,
              jobTitle: faker.person.jobTitle(),
              team: faker.helpers.arrayElement(Team.literals),
              country: CountryCode.make(faker.location.countryCode("alpha-2")),
              tags: faker.helpers.arrayElements(tags, { min: 0, max: 3 }),
            }),
      }),
    );
  }
  return users;
};

/** Each of them signs in with `devPassword`. */
export const devUsers = (): ReadonlyArray<User> => {
  const faker = new Faker({ locale: [en, base] });
  faker.seed(1);
  return [
    devAccount(faker, devAccounts.admin, "admin", "Admin"),
    devAccount(faker, devAccounts.user, "user", "User"),
    ...randomUsers(faker, 100),
  ];
};

export const IdentitySeed = Layer.effectDiscard(
  Effect.gen(function* () {
    const users = yield* UserRepository;
    const seeded = devUsers();
    yield* Effect.forEach(
      seeded,
      (user) =>
        users
          .create(user, devPasswordHash)
          .pipe(Effect.catchTag("EmailAlreadyTaken", () => Effect.void)),
      { discard: true },
    );
    yield* Effect.logInfo(`Seeded ${seeded.length} Users`).pipe(
      Effect.annotateLogs({
        first: seeded.slice(0, 3).map(({ email }) => email),
        password: devPassword,
      }),
    );
  }),
);
