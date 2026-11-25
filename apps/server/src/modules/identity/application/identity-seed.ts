import { base, en, Faker } from "@faker-js/faker";
import { devAccounts, devPassword } from "@quack/contracts/identity/dev-accounts";
import { CountryCode, Profile, Team } from "@quack/contracts/identity/profile";
import {
  Email,
  type Role,
  TimeZone,
  User,
  UserId,
  type UserStatus,
} from "@quack/contracts/identity/user";
import { Auth } from "@yielded/auth";
import { DateTime, Effect, Layer, Schema } from "effect";

import { seedDate } from "#/database/seed-date.ts";
import { AppAuth, localAuthRequest } from "#/modules/identity/domain/app-auth.ts";
import { UserRepository } from "#/modules/identity/domain/user-repository.ts";

const dayMillis = 24 * 60 * 60 * 1000;

const onboardingMillis = 5 * 60 * 1000;

const daysBeforeSeed = (days: number) =>
  DateTime.fromDateUnsafe(new Date(seedDate.getTime() - days * dayMillis));

const paris = Schema.decodeSync(TimeZone)("Europe/Paris");

// Taken in turn, not drawn: a draw of faker would change every User after it.
const timeZones = [
  paris,
  ...[
    "Europe/London",
    "America/New_York",
    "America/Los_Angeles",
    "Asia/Tokyo",
    "Australia/Sydney",
  ].map((zone) => Schema.decodeSync(TimeZone)(zone)),
];

const devAccount = (faker: Faker, email: string, role: Role, firstName: string): User =>
  new User({
    id: UserId.make(faker.string.uuid()),
    email: Schema.decodeSync(Email)(email),
    role,
    status: "active",
    createdAt: daysBeforeSeed(400),
    lastSignInAt: daysBeforeSeed(1),
    onboardedAt: daysBeforeSeed(400),
    profile: new Profile({
      firstName,
      lastName: "Quack",
      avatarUrl: null,
      jobTitle: role === "admin" ? "Administrator" : "Member",
      team: "operations",
      country: CountryCode.make("FR"),
    }),
    timeZone: paris,
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
    const id = UserId.make(faker.string.uuid());

    const lastSignInAt =
      status === "invited"
        ? null
        : DateTime.fromDateUnsafe(faker.date.between({ from: createdAt, to: seedDate }));

    const profile = faker.datatype.boolean({ probability: 0.1 })
      ? null
      : new Profile({
          firstName,
          lastName,
          avatarUrl: faker.datatype.boolean({ probability: 0.6 })
            ? faker.image.personPortrait({ size: 128 })
            : null,
          jobTitle: faker.person.jobTitle(),
          team: faker.helpers.arrayElement(Team.literals),
          country: CountryCode.make(faker.location.countryCode("alpha-2")),
        });

    users.push(
      new User({
        id,
        email: Schema.decodeSync(Email)(email),
        role: "user",
        status,
        createdAt: DateTime.fromDateUnsafe(createdAt),
        lastSignInAt,
        // Onboarded minutes after signing up, by a constant: a draw of faker would change every User after it.
        onboardedAt:
          profile === null || lastSignInAt === null
            ? null
            : DateTime.fromDateUnsafe(new Date(createdAt.getTime() + onboardingMillis)),
        profile,
        // `?? paris` only satisfies the index check: the list is never empty.
        timeZone: timeZones[users.length % timeZones.length] ?? paris,
      }),
    );
  }

  return users;
};

const seededFaker = () => {
  const faker = new Faker({ locale: [en, base] });
  faker.seed(1);

  return faker;
};

// The first draws of the faker, so that their ids do not depend on the random Users.
const devAccountUsers = (faker: Faker): ReadonlyArray<User> => [
  devAccount(faker, devAccounts.admin, "admin", "Admin"),
  devAccount(faker, devAccounts.user, "user", "User"),
];

export const devUsers = (): ReadonlyArray<User> => {
  const faker = seededFaker();

  return [...devAccountUsers(faker), ...randomUsers(faker, 100)];
};

export const devAccountIds = (): ReadonlyArray<UserId> =>
  devAccountUsers(seededFaker()).map(({ id }) => id);

export const IdentitySeed = Layer.effectDiscard(
  Effect.gen(function* () {
    const auth = yield* AppAuth;
    const users = yield* UserRepository;
    const seeded = devUsers();
    // Each User signs up through Yielded, which hashes the dev password for each: Quack cannot write a credential
    // itself. Then the User gets the rest of their seeded state, which a sign-up never gives.
    yield* Effect.forEach(
      seeded,
      (user) =>
        Effect.gen(function* () {
          yield* auth.register({
            requestId: user.id,
            email: user.email,
            newPassword: devPassword,
            registration: { id: user.id, timeZone: user.timeZone.id },
          });
          yield* users.update(user);
        }),
      { concurrency: 4, discard: true },
    ).pipe(Effect.provideService(Auth.AuthRequest, localAuthRequest), Effect.orDie);
    yield* Effect.logInfo(`Seeded ${seeded.length} Users`).pipe(
      Effect.annotateLogs({
        first: seeded.slice(0, 3).map(({ email }) => email),
        password: devPassword,
      }),
    );
  }),
);
