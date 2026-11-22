import { brand } from "@quack/brand/brand";
import { Duration } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { emailChangeConfirmation } from "#/templates/email-change-confirmation.tsx";

describe("emailChangeConfirmation", () => {
  it("links to the confirmation of the email change, in the html and the text", async () => {
    const url = "https://quack.test/confirm-email?token=email-change-token-1";

    const email = await emailChangeConfirmation({ url, lifetime: Duration.hours(24) });

    expect(email.subject).toBe(`Confirm your new ${brand.name} email`);
    expect(email.html).toContain(url);
    expect(email.text).toContain(url);
    expect(email.text).toContain("It lasts 24 hours ");
  });
});
