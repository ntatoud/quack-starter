import { base, en, Faker } from "@faker-js/faker";
import { NodeCrypto } from "@effect/platform-node";
import { devPassword } from "@quack/contracts/identity/dev-accounts";
import { CountryCode, Profile, Team } from "@quack/contracts/identity/profile";
import { Email, TimeZone, User, UserId, type UserStatus } from "@quack/contracts/identity/user";
import { DateTime, Effect, Redacted, Schema } from "effect";

import { seedDate } from "#/database/seed-date.ts";
import { hashPassword } from "#/modules/users/lib/password.ts";
import { userQueries } from "#/modules/users/lib/user-queries.ts";

const onboardingMillis = 5 * 60 * 1000;

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

/**
 * Users of every Status, some with no Profile or never signed in, the same at every run: no endpoint makes a User
 * `invited`, nor one who signed up before today.
 */
export const seedUsers = Effect.gen(function* () {
  const { create } = yield* userQueries;
  const faker = seededFaker();
  const seeded = randomUsers(faker, 100);

  // One hash for them all: argon2 takes tens of milliseconds by design.
  const passwordHash = yield* hashPassword(Redacted.make(devPassword)).pipe(
    Effect.provide([NodeCrypto.layerKdf, NodeCrypto.layerSecureRandom]),
  );

  yield* Effect.forEach(seeded, (user) => Effect.orDie(create(user, passwordHash)), {
    discard: true,
  });
  yield* Effect.logInfo(`Seeded ${seeded.length} Users`).pipe(
    Effect.annotateLogs({
      first: seeded.slice(0, 3).map(({ email }) => email),
      password: devPassword,
    }),
  );
});
