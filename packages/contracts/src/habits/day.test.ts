import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { Day } from "#/habits/day.ts";

describe("Day", () => {
  const decode = Schema.decodeUnknownOption(Day);

  it("accepts a date of the calendar, a leap day included", () => {
    expect(decode("2026-06-01")._tag).toBe("Some");
    expect(decode("2028-02-29")._tag).toBe("Some");
  });

  it("refuses a date the calendar does not have", () => {
    expect(decode("2026-99-99")._tag).toBe("None");
    expect(decode("2026-02-30")._tag).toBe("None");
    expect(decode("2027-02-29")._tag).toBe("None");
  });

  it("refuses an instant and any other spelling", () => {
    expect(decode("2026-06-01T00:00:00Z")._tag).toBe("None");
    expect(decode("2026-6-1")._tag).toBe("None");
  });
});
