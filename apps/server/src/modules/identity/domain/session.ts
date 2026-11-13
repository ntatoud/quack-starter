import type { UserId } from "@quack/contracts/identity/user";
import { DateTime, Duration } from "effect";

/** How long a Session lasts from the moment it is created. */
export const sessionLifetime = Duration.days(30);

/** The number of random bytes in a Session token. */
export const sessionTokenBytes = 32;

/**
 * The proof that a User has signed in.
 * The token itself only exists in the User's cookie: the server keeps its SHA-256, so a leaked store opens no Session.
 */
export interface Session {
  /** SHA-256 of the token, in hex. */
  readonly tokenHash: string;
  readonly userId: UserId;
  readonly expiresAt: DateTime.Utc;
}

export const isExpired = (session: Session, now: DateTime.Utc): boolean =>
  DateTime.isGreaterThanOrEqualTo(now, session.expiresAt);
