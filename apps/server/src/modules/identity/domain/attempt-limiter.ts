import type { TooManyAttempts } from "@quack/contracts/identity/identity-errors";
import type { Email } from "@quack/contracts/identity/user";
import { Context, type Effect } from "effect";

/** The address a request comes from, as the web app's relay names it. */
export type ClientIp = string;

/**
 * What the limiter counts. Each counter has its own limit and its own window, which the adapter holds.
 * No counter belongs to a User: an email is counted whether a User has it or not.
 */
export type AttemptCounter =
  /** Sign-ins that failed on this email. An `Email` is normalized, so one address has one counter. */
  | { readonly _tag: "SignInFailuresOfEmail"; readonly email: Email }
  /** Sign-ins that failed from this address, whatever the email. */
  | { readonly _tag: "SignInFailuresOfIp"; readonly ip: ClientIp }
  /** Sign-ups from this address. */
  | { readonly _tag: "SignUpsOfIp"; readonly ip: ClientIp };

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
