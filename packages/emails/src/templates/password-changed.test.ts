import { describe, expect, it } from "vite-plus/test";
import { brand } from "@quack/brand/brand";
import { passwordChanged } from "#/templates/password-changed.tsx";

describe("passwordChanged", () => {
  it("links to a Password Reset, in the html and the text", async () => {
    const resetUrl = "https://quack.test/forgot-password";

    const email = await passwordChanged({ resetUrl });

    expect(email.subject).toBe(`Your ${brand.name} password changed`);
    expect(email.html).toContain(resetUrl);
    expect(email.text).toContain(resetUrl);
  });
});
