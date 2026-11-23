import { assert, it as effect } from "@effect/vitest";
import { CountryCode, Profile } from "@quack/contracts/identity/profile";
import { Email, TimeZone, User, UserId } from "@quack/contracts/identity/user";
import { DateTime, Effect, Schema } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "vite-plus/test";

import { onboarded, today } from "#/modules/identity/domain/user.ts";

const user = (fields: Pick<User, "profile" | "onboardedAt"> & Partial<Pick<User, "timeZone">>) =>
  new User({
    id: UserId.make("user-1"),
    email: Email.make("ada@example.com"),
    role: "user",
    status: "active",
    createdAt: DateTime.makeUnsafe(0),
    lastSignInAt: null,
    timeZone: DateTime.zoneMakeNamedUnsafe("Europe/Paris"),
    ...fields,
  });

const now = DateTime.makeUnsafe("2026-06-01T00:00:00Z");

describe("onboarded", () => {
  it("gives a User with no Profile one with their name, nothing else filled in, and the date", () => {
    expect(
      onboarded(
        user({ profile: null, onboardedAt: null }),
        { firstName: "Ada", lastName: "Lovelace" },
        now,
      ),
    ).toEqual(
      user({
        onboardedAt: now,
        profile: new Profile({
          firstName: "Ada",
          lastName: "Lovelace",
          avatarUrl: null,
          jobTitle: "",
          team: null,
          country: null,
        }),
      }),
    );
  });

  it("changes the name of a Profile, and keeps the rest of it", () => {
    const profile = new Profile({
      firstName: "Ada",
      lastName: "Lovelace",
      avatarUrl: "https://example.com/ada.png",
      jobTitle: "Analyst",
      team: "engineering",
      country: CountryCode.make("GB"),
    });

    expect(
      onboarded(user({ profile, onboardedAt: null }), { firstName: "Ada", lastName: "Byron" }, now)
        .profile,
    ).toEqual(new Profile({ ...profile, lastName: "Byron" }));
  });

  it("keeps the date of a first onboarding", () => {
    const first = DateTime.makeUnsafe("2026-01-01T00:00:00Z");

    expect(
      onboarded(
        user({ profile: null, onboardedAt: first }),
        { firstName: "Ada", lastName: "Lovelace" },
        now,
      ).onboardedAt,
    ).toEqual(first);
  });
});

describe("today", () => {
  const livingIn = (zone: string) =>
    user({ profile: null, onboardedAt: null, timeZone: Schema.decodeSync(TimeZone)(zone) });

  const paris = livingIn("Europe/Paris");
  const newYork = livingIn("America/New_York");

  const at = (instant: string) => TestClock.setTime(DateTime.makeUnsafe(instant).epochMilliseconds);

  effect.effect("turns at midnight in Paris, two hours before midnight in UTC in summer", () =>
    Effect.gen(function* () {
      yield* at("2026-06-01T21:59:59Z");
      assert.strictEqual(yield* today(paris), "2026-06-01");

      yield* at("2026-06-01T22:00:00Z");
      assert.strictEqual(yield* today(paris), "2026-06-02");
    }),
  );

  effect.effect("turns at midnight in New York, four hours after midnight in UTC in summer", () =>
    Effect.gen(function* () {
      yield* at("2026-06-02T03:59:59Z");
      assert.strictEqual(yield* today(newYork), "2026-06-01");

      yield* at("2026-06-02T04:00:00Z");
      assert.strictEqual(yield* today(newYork), "2026-06-02");
    }),
  );

  effect.effect("is not the same Day for two Users at the same instant", () =>
    Effect.gen(function* () {
      yield* at("2026-06-01T23:30:00Z");

      assert.strictEqual(yield* today(paris), "2026-06-02");
      assert.strictEqual(yield* today(newYork), "2026-06-01");
    }),
  );

  effect.effect("follows the winter time: midnight in Paris is 23:00 in UTC", () =>
    Effect.gen(function* () {
      yield* at("2026-12-31T22:59:59Z");
      assert.strictEqual(yield* today(paris), "2026-12-31");

      yield* at("2026-12-31T23:00:00Z");
      assert.strictEqual(yield* today(paris), "2027-01-01");
    }),
  );
});
