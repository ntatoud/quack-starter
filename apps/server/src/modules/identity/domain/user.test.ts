import { CountryCode, Profile } from "@quack/contracts/identity/profile";
import { Email, User, UserId } from "@quack/contracts/identity/user";
import { DateTime } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { onboarded } from "#/modules/identity/domain/user.ts";

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
