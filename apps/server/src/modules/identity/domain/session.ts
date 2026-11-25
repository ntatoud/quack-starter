import { Duration } from "effect";

/** Absolute: Yielded Auth renews a Session only when asked, and nothing asks yet. */
export const sessionLifetime = Duration.days(30);
