import type { UserId } from "@quack/contracts/identity/user";
import { DateTime, Duration, Option } from "effect";

export const sessionLifetime = Duration.days(30);

/** Under this, a request extends the Session; above it, the request writes nothing. */
export const sessionExtensionThreshold = Duration.days(15);

export const sessionTokenBytes = 32;

/** The token lives only in the User's cookie: a leaked store opens no Session. */
export interface Session {
  /** SHA-256 of the token, in hex. */
  readonly tokenHash: string;
  readonly userId: UserId;
  readonly expiresAt: DateTime.Utc;
}

export const isExpired = (session: Session, now: DateTime.Utc): boolean =>
  DateTime.isGreaterThanOrEqualTo(now, session.expiresAt);

export const expiryFrom = (now: DateTime.Utc): DateTime.Utc =>
  DateTime.addDuration(now, sessionLifetime);

export const extension = (session: Session, now: DateTime.Utc): Option.Option<DateTime.Utc> =>
  Duration.isLessThan(DateTime.distance(now, session.expiresAt), sessionExtensionThreshold)
    ? Option.some(expiryFrom(now))
    : Option.none();
