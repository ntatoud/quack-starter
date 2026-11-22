import type { TooManyAttempts } from "@quack/contracts/identity/identity-errors";
import type { Email, UserId } from "@quack/contracts/identity/user";
import { Context, type Effect } from "effect";

export type ClientIp = string;

export type AttemptLimit =
  | "signInFailuresPerEmail"
  | "signInFailuresPerIp"
  | "signUpsPerIp"
  | "clientDocumentFetchesPerUser"
  | "tokenFailuresPerIp";

export class AttemptCounter {
  readonly limit: AttemptLimit;
  readonly subject: string;

  private constructor(limit: AttemptLimit, subject: string) {
    this.limit = limit;
    this.subject = subject;
  }

  static signInFailuresOfEmail(email: Email) {
    return new AttemptCounter("signInFailuresPerEmail", email);
  }

  static signInFailuresOfIp(ip: ClientIp) {
    return new AttemptCounter("signInFailuresPerIp", ip);
  }

  static signUpsOfIp(ip: ClientIp) {
    return new AttemptCounter("signUpsPerIp", ip);
  }

  static clientDocumentFetchesOfUser(userId: UserId) {
    return new AttemptCounter("clientDocumentFetchesPerUser", userId);
  }

  static tokenFailuresOfIp(ip: ClientIp) {
    return new AttemptCounter("tokenFailuresPerIp", ip);
  }
}

export class AttemptLimiter extends Context.Service<
  AttemptLimiter,
  {
    /** Atomic: when one counter is at its limit, it fails and counts on none, so concurrent attempts cannot overshoot. */
    take(counters: ReadonlyArray<AttemptCounter>): Effect.Effect<void, TooManyAttempts>;
    giveBack(counter: AttemptCounter): Effect.Effect<void>;
    reset(counter: AttemptCounter): Effect.Effect<void>;
  }
>()("@quack/server/identity/AttemptLimiter") {}
