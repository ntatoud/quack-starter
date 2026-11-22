import { brand } from "@quack/brand/brand";
import { Duration } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { passwordReset } from "#/templates/password-reset.tsx";

describe("passwordReset", () => {
  it("links to the choice of a new password, in the html and the text", async () => {
    const url = "https://quack.test/reset-password?token=reset-token-1";

    const email = await passwordReset({ url, lifetime: Duration.hours(1) });

    expect(email.subject).toBe(`Reset your ${brand.name} password`);
    expect(email.html).toContain(url);
    expect(email.text).toContain(url);
  });

  it("says how long the link lasts", async () => {
    const url = "https://quack.test/reset-password?token=reset-token-2";

    const inHours = await passwordReset({ url, lifetime: Duration.hours(1) });
    const inMinutes = await passwordReset({ url, lifetime: Duration.minutes(30) });

    expect(inHours.text).toContain("It lasts 1 hour ");
    expect(inMinutes.text).toContain("It lasts 30 minutes ");
  });
});
