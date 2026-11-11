import { describe, expect, it } from "vite-plus/test";

import { tooManyAttemptsMessage } from "#/features/identity/retry-delay.ts";

describe("tooManyAttemptsMessage", () => {
  it.each([
    [1, "Too many attempts. Try again in 1 second."],
    [59, "Too many attempts. Try again in 59 seconds."],
    [60, "Too many attempts. Try again in 1 minute."],
    // Rounded up: the wait is never shorter than what the form says.
    [61, "Too many attempts. Try again in 2 minutes."],
    [900, "Too many attempts. Try again in 15 minutes."],
    [3600, "Too many attempts. Try again in 60 minutes."],
  ])("says how long to wait for a retryAfter of %i seconds", (retryAfter, message) => {
    expect(tooManyAttemptsMessage(retryAfter)).toBe(message);
  });
});
