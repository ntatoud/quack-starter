import { describe, expect, it } from "vite-plus/test";
import { emailChangeNotice } from "#/templates/email-change-notice.tsx";

describe("emailChangeNotice", () => {
  it("names the email asked for, masked, in the html and the text", async () => {
    const email = await emailChangeNotice({ newEmail: "jane.doe@example.com" });

    expect(email.subject).toBe("Your Quack email is changing");
    expect(email.html).toContain("j***@example.com");
    expect(email.text).toContain("j***@example.com");
    expect(email.html).not.toContain("jane.doe");
    expect(email.text).not.toContain("jane.doe");
  });
});
