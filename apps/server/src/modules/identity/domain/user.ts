import type { OnboardingPayload } from "@quack/contracts/identity/identity-api";
import { Profile } from "@quack/contracts/identity/profile";
import { User } from "@quack/contracts/identity/user";
import type { DateTime } from "effect";

export const canSignIn = (user: User) => user.status === "active";

export const signedIn = (user: User, at: DateTime.Utc): User =>
  new User({ ...user, lastSignInAt: at });

export const withProfile = (user: User, profile: Profile): User => new User({ ...user, profile });

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
