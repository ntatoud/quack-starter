import { assert, describe, it } from "@effect/vitest";
import { DateTime } from "effect";

import { seedDate } from "#/database/seed-date.ts";
import { devAccountIds, devUsers } from "#/modules/identity/application/identity-seed.ts";

describe("devUsers", () => {
  it("gives the same Users, ids and dates included, at every run", () => {
    assert.deepStrictEqual(devUsers(), devUsers());
    // Noted from an earlier run, in another process.
    const [admin, , firstRandom] = devUsers();
    assert.strictEqual(admin?.id, "6b042125-686a-43e0-8a68-23cf5bee102e");
    assert.strictEqual(firstRandom?.id, "62e5cbe9-c54e-46fa-b91f-7963e90958e5");
    assert.strictEqual(firstRandom?.email, "ansel_larkin90@yahoo.com");
  });

  it("gives admin@quack.dev as the only admin, then user@quack.dev and 100 other Users, each with an id and an email of its own", () => {
    const seeded = devUsers();

    assert.deepStrictEqual(
      seeded.slice(0, 2).map(({ email }) => email),
      ["admin@quack.dev", "user@quack.dev"],
    );
    assert.strictEqual(new Set(seeded.map(({ email }) => email)).size, 102);
    assert.strictEqual(new Set(seeded.map(({ id }) => id)).size, 102);
    assert.deepStrictEqual(
      seeded.filter(({ role }) => role === "admin").map(({ email }) => email),
      ["admin@quack.dev"],
    );
  });

  it("gives Users of every status, the dev accounts active", () => {
    const seeded = devUsers();

    assert.deepStrictEqual([...new Set(seeded.map(({ status }) => status))].toSorted(), [
      "active",
      "invited",
      "suspended",
    ]);
    assert.deepStrictEqual(
      seeded.slice(0, 2).map(({ status }) => status),
      ["active", "active"],
    );
  });

  it("gives Users created before the seed date, the invited never signed in", () => {
    const seedMillis = seedDate.getTime();

    for (const { status, createdAt, lastSignInAt } of devUsers()) {
      assert.isAtMost(DateTime.toEpochMillis(createdAt), seedMillis);

      if (lastSignInAt !== null) {
        assert.isAtLeast(DateTime.toEpochMillis(lastSignInAt), DateTime.toEpochMillis(createdAt));
        assert.isAtMost(DateTime.toEpochMillis(lastSignInAt), seedMillis);
      }

      assert.strictEqual(lastSignInAt === null, status === "invited");
    }
  });

  it("gives an onboarding date to the Users with a Profile who signed in, and to them only", () => {
    for (const { profile, lastSignInAt, onboardedAt, createdAt } of devUsers()) {
      assert.strictEqual(onboardedAt !== null, profile !== null && lastSignInAt !== null);

      if (onboardedAt !== null) {
        assert.isAtLeast(DateTime.toEpochMillis(onboardedAt), DateTime.toEpochMillis(createdAt));
      }
    }
  });

  it("gives a Profile to most Users, not all", () => {
    const seeded = devUsers();
    const withProfile = seeded.filter(({ profile }) => profile !== null);

    assert.isAbove(withProfile.length, seeded.length / 2);
    assert.isBelow(withProfile.length, seeded.length);
  });
});

describe("devAccountIds", () => {
  it("gives the ids of admin@quack.dev and user@quack.dev among the seeded Users", () => {
    const emailsById = new Map(devUsers().map(({ id, email }) => [id, email]));

    assert.deepStrictEqual(
      devAccountIds().map((id) => String(emailsById.get(id))),
      ["admin@quack.dev", "user@quack.dev"],
    );
  });
});
