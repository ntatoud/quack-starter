import { TooManyAttempts } from "@quack/contracts/identity/identity-errors";
import { Clock, Duration, Effect, Layer } from "effect";

import { ServerConfig } from "#/config.ts";
import { type AttemptCounter, AttemptLimiter } from "#/modules/identity/domain/attempt-limiter.ts";

/** The attempts counted in the window that is open, and when that window ends, in milliseconds. */
interface AttemptWindow {
  readonly count: number;
  readonly endsAt: number;
}

/** How often the windows that have ended are swept out of the map, in milliseconds. */
const sweepEvery = Duration.toMillis(Duration.minutes(1));

/**
 * Counters in the memory of the process, with the limits of `ServerConfig`.
 *
 * Not built on Effect's `RateLimiter` (`effect/persistence/RateLimiter`). Its `consume` could count the failures
 * only: `tokens: 0` reads a counter, `tokens: 1` counts on it. But neither `RateLimiter` nor its `RateLimiterStore`
 * has an operation that sets a counter back to zero, which a sign-in that succeeds needs.
 *
 * Each operation reads and writes the map in one synchronous step, so two requests never interleave inside one.
 */
export const AttemptLimiterMemory = Layer.effect(
  AttemptLimiter,
  Effect.gen(function* () {
    const { attemptLimits } = yield* ServerConfig;
    const windows = new Map<string, AttemptWindow>();
    let sweptAt = yield* Clock.currentTimeMillis;

    /** Where the counter is kept in the map, and what it allows. */
    const slotOf = (counter: AttemptCounter) => ({
      key: `${counter.limit}:${counter.subject}`,
      ...attemptLimits[counter.limit],
    });

    /** The window kept under `key` that is open at `now`, if one is. */
    const openWindow = (key: string, now: number): AttemptWindow | undefined => {
      const window = windows.get(key);
      return window !== undefined && window.endsAt > now ? window : undefined;
    };

    /** Removes the windows that have ended: a counter nobody reads again would stay for good. */
    const sweep = (now: number) => {
      if (now - sweptAt < sweepEvery) return;
      sweptAt = now;
      for (const [key, window] of windows) {
        if (window.endsAt <= now) windows.delete(key);
      }
    };

    return AttemptLimiter.of({
      take: Effect.fn("AttemptLimiter.take")(function* (counters) {
        const now = yield* Clock.currentTimeMillis;
        sweep(now);
        const slots = counters.map((counter) => {
          const slot = slotOf(counter);
          return { ...slot, open: openWindow(slot.key, now) };
        });
        const waitMillis = Math.max(
          0,
          ...slots.map(({ open, limit }) =>
            open !== undefined && open.count >= limit ? open.endsAt - now : 0,
          ),
        );
        if (waitMillis > 0) {
          // Rounded up: an attempt made `retryAfter` seconds later finds the window ended.
          return yield* new TooManyAttempts({ retryAfter: Math.ceil(waitMillis / 1000) });
        }
        for (const { key, open, window } of slots) {
          windows.set(key, {
            count: (open?.count ?? 0) + 1,
            endsAt: open?.endsAt ?? now + Duration.toMillis(window),
          });
        }
      }),
      giveBack: Effect.fn("AttemptLimiter.giveBack")(function* (counter) {
        const now = yield* Clock.currentTimeMillis;
        const { key } = slotOf(counter);
        const open = openWindow(key, now);
        if (open === undefined || open.count <= 1) {
          windows.delete(key);
        } else {
          windows.set(key, { ...open, count: open.count - 1 });
        }
      }),
      reset: Effect.fn("AttemptLimiter.reset")(function* (counter) {
        yield* Effect.sync(() => windows.delete(slotOf(counter).key));
      }),
    });
  }),
);
