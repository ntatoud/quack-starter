import { Redacted, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { Email, Password } from "#/identity/user.ts";

describe("Email", () => {
  const decode = Schema.decodeUnknownOption(Email);

  it("trims and lowercases, so one address has one spelling", () => {
    expect(Schema.decodeSync(Email)("  Ada@Example.COM ")).toBe("ada@example.com");
  });

  it("requires an @ with text on each side", () => {
    expect(decode("ada@example.com")._tag).toBe("Some");
    expect(decode("ada")._tag).toBe("None");
    expect(decode("@example.com")._tag).toBe("None");
    expect(decode("ada@")._tag).toBe("None");
    expect(decode(" @ ")._tag).toBe("None");
    expect(decode("ada@example@com")._tag).toBe("None");
  });

  it("accepts at most 254 characters", () => {
    const domain = "@example.com";

    expect(decode("a".repeat(254 - domain.length) + domain)._tag).toBe("Some");
    expect(decode("a".repeat(255 - domain.length) + domain)._tag).toBe("None");
  });
});

describe("Password", () => {
  const decode = Schema.decodeUnknownOption(Password);

  it("accepts 12 to 128 characters", () => {
    expect(decode("x".repeat(11))._tag).toBe("None");
    expect(decode("x".repeat(12))._tag).toBe("Some");
    expect(decode("x".repeat(128))._tag).toBe("Some");
    expect(decode("x".repeat(129))._tag).toBe("None");
  });

  it("has no composition rule and keeps the password as typed, spaces included", () => {
    const password = Schema.decodeSync(Password)("  twelve spaces and more  ");

    expect(Redacted.value(password)).toBe("  twelve spaces and more  ");
  });

  it("is redacted, so it does not show in a log", () => {
    const password = Schema.decodeSync(Password)("correct horse battery");

    expect(String(password)).not.toContain("correct horse battery");
    expect(JSON.stringify({ password })).not.toContain("correct horse battery");
  });
});
