import { describe, expect, it } from "vite-plus/test";
import { brand } from "@quack/brand/brand";
import { passwordReset } from "#/templates/password-reset.tsx";

describe("passwordReset", () => {
  it("links to the choice of a new password, in the html and the text", async () => {
    const url = "https://quack.test/reset-password?token=reset-token-1";

    const email = await passwordReset({ url });

    expect(email.subject).toBe(`Reset your ${brand.name} password`);
    expect(email.html).toContain(url);
    expect(email.text).toContain(url);
  });
});
