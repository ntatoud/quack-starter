const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? "" : "s"}`;

/** Rounded up: the wait is never shorter than what the form says. */
export const tooManyAttemptsMessage = (retryAfter: number): string =>
  `Too many attempts. Try again in ${
    retryAfter < 60 ? plural(retryAfter, "second") : plural(Math.ceil(retryAfter / 60), "minute")
  }.`;
