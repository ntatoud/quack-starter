import { User } from "@quack/contracts/identity/user";
import type { DateTime } from "effect";

export const canSignIn = (user: User) => user.status === "active";

export const signedIn = (user: User, at: DateTime.Utc): User =>
  new User({ ...user, lastSignInAt: at });
