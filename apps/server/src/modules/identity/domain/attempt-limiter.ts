import type { TooManyAttempts } from "@quack/contracts/identity/identity-errors";
import type { Email } from "@quack/contracts/identity/user";
import { Context, type Effect } from "effect";

/** The address a request comes from, as the web app's relay names it. */
export type ClientIp = string;

/** The limits the limiter enforces. The adapter holds how many attempts each allows, and in which window. */
export type AttemptLimit = "signInFailuresPerEmail" | "signInFailuresPerIp" | "signUpsPerIp";

/**
 * What the limiter counts: attempts against one limit, on one email or from one address.
 * No counter belongs to a User: an email is counted whether a User has it or not.
 */
export class AttemptCounter {
  readonly limit: AttemptLimit;
  readonly subject: string;

  private constructor(limit: AttemptLimit, subject: string) {
    this.limit = limit;
    this.subject = subject;
  }

  /** An `Email` is normalized, so one address has one counter. */
  static signInFailuresOfEmail(email: Email) {
    return new AttemptCounter("signInFailuresPerEmail", email);
  }

  /** Whatever the email. */
  static signInFailuresOfIp(ip: ClientIp) {
    return new AttemptCounter("signInFailuresPerIp", ip);
  }

  static signUpsOfIp(ip: ClientIp) {
    return new AttemptCounter("signUpsPerIp", ip);
  }
}

/**
 * Port. Slows down the guessing of passwords and the mass creation of Users.
 *
 * A counter lives in a fixed window: the window opens at the first attempt counted, lasts its whole duration
 * whatever comes after, and the counter starts again from zero once it has ended.
 * So a refusal is always temporary: nothing here locks a User out for good.
 */
export class AttemptLimiter extends Context.Service<
  AttemptLimiter,
  {
    /**
     * Counts one attempt on each of the counters, unless one of them has reached its limit in its current window:
     * then it fails and counts nothing. `retryAfter` is when the last of the windows that refuse ends.
     * It is one step: of the attempts that arrive at once, no more than the limit get through.
     */
    take(counters: ReadonlyArray<AttemptCounter>): Effect.Effect<void, TooManyAttempts>;
    /** Takes one attempt off the counter: one that `take` counted, and that is not to count after all. */
    giveBack(counter: AttemptCounter): Effect.Effect<void>;
    /** Sets the counter back to zero, as if nothing had been counted on it. */
    reset(counter: AttemptCounter): Effect.Effect<void>;
  }
>()("@quack/server/identity/AttemptLimiter") {}
