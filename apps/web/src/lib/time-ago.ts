const relativeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const units: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

/** In the largest unit that fits, past or to come: "3 days ago", "last month", "in 2 hours". */
export const timeAgo = (date: Date, now: Date) => {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);

  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relativeFormat.format(Math.round(seconds / size), unit);
  }

  return "just now";
};
