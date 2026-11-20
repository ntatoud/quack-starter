import { DateTime } from "effect";

/** Day `n` of January 2026, at midnight UTC. */
export const day = (n: number) =>
  DateTime.makeUnsafe(`2026-01-${String(n).padStart(2, "0")}T00:00:00Z`);

export const dayOrNull = (n: number | null) => (n === null ? null : day(n));
