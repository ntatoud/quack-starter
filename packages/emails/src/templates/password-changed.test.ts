import { describe, expect, it } from "vite-plus/test";
import { passwordChanged } from "#/templates/password-changed.tsx";

describe("passwordChanged", () => {
  it("links to a Password Reset, in the html and the text", async () => {
    const resetUrl = "https://quack.test/forgot-password";

    const email = await passwordChanged({ resetUrl });

    expect(email.subject).toBe("Your Quack password changed");
    expect(email.html).toContain(resetUrl);
    expect(email.text).toContain(resetUrl);
  });
});
