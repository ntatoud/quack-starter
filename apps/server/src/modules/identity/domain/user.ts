import type { OnboardingPayload } from "@quack/contracts/identity/identity-api";
import { Profile } from "@quack/contracts/identity/profile";
import { Day } from "@quack/contracts/habits/day";
import { type TimeZone, User } from "@quack/contracts/identity/user";
import { DateTime, Effect } from "effect";

export const canSignIn = (user: User) => user.status === "active";

export const signedIn = (user: User, at: DateTime.Utc): User =>
  new User({ ...user, lastSignInAt: at });

export const withProfile = (user: User, profile: Profile): User => new User({ ...user, profile });

export const withTimeZone = (user: User, timeZone: TimeZone): User =>
  new User({ ...user, timeZone });

/** The Day it is where the User lives, read from the clock: never a date a client sends. */
export const today = (user: User): Effect.Effect<Day> =>
  Effect.map(DateTime.now, (now) =>
    Day.make(DateTime.formatIsoDate(DateTime.setZone(now, user.timeZone))),
  );

/** Sets the name of the Profile, creating it when the User has none. A second onboarding keeps the first date. */
export const onboarded = (user: User, name: OnboardingPayload, at: DateTime.Utc): User =>
  new User({
    ...user,
    onboardedAt: user.onboardedAt ?? at,
    profile: new Profile({
      avatarUrl: null,
      jobTitle: "",
      team: null,
      country: null,
      ...user.profile,
      ...name,
    }),
  });
