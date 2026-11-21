import { describe, expect, it } from "vite-plus/test";
import { emailChangeConfirmation } from "#/templates/email-change-confirmation.tsx";

describe("emailChangeConfirmation", () => {
  it("links to the confirmation of the Email Change, in the html and the text", async () => {
    const url = "https://quack.test/confirm-email?token=email-change-token-1";

    const email = await emailChangeConfirmation({ url });

    expect(email.subject).toBe("Confirm your new Quack email");
    expect(email.html).toContain(url);
    expect(email.text).toContain(url);
  });
});
