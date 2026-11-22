import { TooManyAttempts } from "@quack/contracts/identity/identity-errors";
import { Clock, Duration, Effect, Layer } from "effect";

import { ServerConfig } from "#/config.ts";
import { type AttemptCounter, AttemptLimiter } from "#/modules/identity/domain/attempt-limiter.ts";

interface AttemptWindow {
  readonly count: number;
  readonly endsAtMillis: number;
}

const sweepEveryMillis = Duration.toMillis(Duration.minutes(1));

/**
 * Not Effect's `RateLimiter`: neither it nor its `RateLimiterStore` can set a counter back to zero.
 * Each operation reads and writes the map in one synchronous step, so two requests never interleave inside one.
 */
export const AttemptLimiterMemory = Layer.effect(
  AttemptLimiter,
  Effect.gen(function* () {
    const attemptLimits = yield* ServerConfig.attemptLimits;
    const windows = new Map<string, AttemptWindow>();
    let sweptAt = yield* Clock.currentTimeMillis;

    const slotOf = (counter: AttemptCounter) => ({
      key: `${counter.limit}:${counter.subject}`,
      ...attemptLimits[counter.limit],
    });

    const openWindow = (key: string, now: number): AttemptWindow | undefined => {
      const window = windows.get(key);

      return window !== undefined && window.endsAtMillis > now ? window : undefined;
    };

    // Without it, a counter nobody reads again would stay for good.
    const sweep = (now: number) => {
      if (now - sweptAt < sweepEveryMillis) return;
      sweptAt = now;

      for (const [key, window] of windows) {
        if (window.endsAtMillis <= now) windows.delete(key);
      }
    };

    return AttemptLimiter.of({
      take: Effect.fn("AttemptLimiter.take")(function* (counters) {
        const now = yield* Clock.currentTimeMillis;
        sweep(now);

        const slots = counters.map((counter) => {
          const slot = slotOf(counter);

          return { ...slot, counter, open: openWindow(slot.key, now) };
        });

        const waitMillis = Math.max(
          0,
          ...slots.map(({ open, limit }) =>
            open !== undefined && open.count >= limit ? open.endsAtMillis - now : 0,
          ),
        );

        if (waitMillis > 0) {
          const reached = slots.filter(
            ({ open, limit }) => open !== undefined && open.count >= limit,
          );

          const annotations = new Map([
            ["attempt.limits", reached.map(({ counter }) => counter.limit).join(",")],
          ]);

          const ip = counters.find((counter) => counter.limit !== "signInFailuresPerEmail");

          // The address and never the email: the address is what an operator can block.
          if (ip !== undefined) annotations.set("client.address", ip.subject);

          yield* Effect.logWarning("Attempt limit reached").pipe(
            Effect.annotateLogs(Object.fromEntries(annotations)),
          );

          // Rounded up: an attempt made `retryAfter` seconds later finds the window ended.
          return yield* new TooManyAttempts({ retryAfter: Math.ceil(waitMillis / 1000) });
        }

        for (const { key, open, window } of slots) {
          windows.set(key, {
            count: (open?.count ?? 0) + 1,
            endsAtMillis: open?.endsAtMillis ?? now + Duration.toMillis(window),
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
