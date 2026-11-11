const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? "" : "s"}`;

/**
 * What a form says when the API refuses with `TooManyAttempts`: how long to wait, from its `retryAfter` in seconds.
 * In seconds under a minute, in minutes above, rounded up: the wait is never shorter than what the form says.
 */
export const tooManyAttemptsMessage = (retryAfter: number): string =>
  `Too many attempts. Try again in ${
    retryAfter < 60 ? plural(retryAfter, "second") : plural(Math.ceil(retryAfter / 60), "minute")
  }.`;
