import { Duration } from "effect";

const count = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

export const formatLifetime = (lifetime: Duration.Duration) => {
  const hours = Duration.toHours(lifetime);

  return Number.isInteger(hours)
    ? count(hours, "hour")
    : count(Math.round(Duration.toMinutes(lifetime)), "minute");
};
