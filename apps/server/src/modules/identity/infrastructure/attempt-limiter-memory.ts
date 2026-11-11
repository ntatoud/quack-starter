import { TooManyAttempts } from "@quack/contracts/identity/identity-errors";
import { Clock, Duration, Effect, Layer } from "effect";

import { ServerConfig } from "#/config.ts";
import { type AttemptCounter, AttemptLimiter } from "#/modules/identity/domain/attempt-limiter.ts";

/** The attempts counted in the window that is open, and when that window ends, in milliseconds. */
interface Window {
  readonly count: number;
  readonly endsAt: number;
}

const keyOf = (counter: AttemptCounter) =>
  `${counter._tag}:${counter._tag === "SignInFailuresOfEmail" ? counter.email : counter.ip}`;

/**
 * Counters in the memory of the process, with the limits of `ServerConfig`.
 *
 * Not built on Effect's `RateLimiter` (`effect/persistence/RateLimiter`). Its `consume` could count the failures
 * only: `tokens: 0` reads a counter, `tokens: 1` counts on it. But neither `RateLimiter` nor its `RateLimiterStore`
 * has an operation that sets a counter back to zero, which a sign-in that succeeds needs.
 *
 * Nothing sweeps the map: a window that has ended leaves it when its counter is read or reset.
 */
export const AttemptLimiterMemory = Layer.effect(
  AttemptLimiter,
  Effect.gen(function* () {
    const { attemptLimits } = yield* ServerConfig;
    const windows = new Map<string, Window>();

    const limitOf = (counter: AttemptCounter) => {
      switch (counter._tag) {
        case "SignInFailuresOfEmail":
          return attemptLimits.signInFailuresPerEmail;
        case "SignInFailuresOfIp":
          return attemptLimits.signInFailuresPerIp;
        case "SignUpsOfIp":
          return attemptLimits.signUpsPerIp;
      }
    };

    /** The window of the counter that is open at `now`, if one is. */
    const openWindow = (counter: AttemptCounter, now: number): Window | undefined => {
      const key = keyOf(counter);
      const window = windows.get(key);
      if (window !== undefined && window.endsAt <= now) {
        windows.delete(key);
        return undefined;
      }
      return window;
    };

    const check = Effect.fn("AttemptLimiter.check")(function* (
      counters: ReadonlyArray<AttemptCounter>,
    ) {
      const now = yield* Clock.currentTimeMillis;
      let waitMillis = 0;
      for (const counter of counters) {
        const window = openWindow(counter, now);
        if (window !== undefined && window.count >= limitOf(counter).limit) {
          waitMillis = Math.max(waitMillis, window.endsAt - now);
        }
      }
      if (waitMillis > 0) {
        // Rounded up: an attempt made `retryAfter` seconds later finds the window ended.
        return yield* new TooManyAttempts({ retryAfter: Math.ceil(waitMillis / 1000) });
      }
    });

    const record = Effect.fn("AttemptLimiter.record")(function* (
      counters: ReadonlyArray<AttemptCounter>,
    ) {
      const now = yield* Clock.currentTimeMillis;
      for (const counter of counters) {
        const window = openWindow(counter, now) ?? {
          count: 0,
          endsAt: now + Duration.toMillis(limitOf(counter).window),
        };
        windows.set(keyOf(counter), { ...window, count: window.count + 1 });
      }
    });

    const reset = (counter: AttemptCounter) =>
      Effect.sync(() => void windows.delete(keyOf(counter)));

    return AttemptLimiter.of({ check, record, reset });
  }),
);
