import type { UserId } from "@quack/contracts/identity/user";
import { DateTime, Duration, Option } from "effect";

/** How long a Session lasts from the moment it is created. */
export const sessionLifetime = Duration.days(30);

/** A request extends a Session that has less than this left: one that has more is left as it is, so most requests write nothing. */
export const sessionRenewalThreshold = Duration.days(15);

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

/**
 * The Session a request made at `now` extends: it lasts a whole lifetime again, from `now`.
 * None when the Session has enough time left. A Session has no other limit: its User keeps it as long as they come back.
 */
export const renew = (session: Session, now: DateTime.Utc): Option.Option<Session> =>
  Duration.isLessThan(DateTime.distance(now, session.expiresAt), sessionRenewalThreshold)
    ? Option.some({ ...session, expiresAt: DateTime.addDuration(now, sessionLifetime) })
    : Option.none();
