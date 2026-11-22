import { describe, expect, it } from "vite-plus/test";

import { type GrantTerms, remembersConsent } from "#/modules/identity/domain/grant.ts";

const grant: GrantTerms = {
  aiClientId: "https://claude.ai/oauth/client.json",
  resource: "https://quack.test/api/mcp",
  redirectUri: "https://claude.ai/api/mcp/auth_callback",
  permissions: ["todos:list", "todos:write"],
};

describe("remembersConsent", () => {
  it("remembers the consent a Grant holds for the same AI Client, resource, and redirect URI", () => {
    expect(remembersConsent(grant, grant)).toBe(true);
    expect(remembersConsent(grant, { ...grant, permissions: ["todos:write"] })).toBe(true);
  });

  it("remembers it for an AI Client on this machine that comes back on another port", () => {
    const local = { ...grant, redirectUri: "http://localhost:51234/callback" };

    expect(
      remembersConsent(local, { ...local, redirectUri: "http://localhost:40001/callback" }),
    ).toBe(true);
    expect(remembersConsent(local, { ...local, redirectUri: "http://localhost:40001/other" })).toBe(
      false,
    );
  });

  it.each([
    ["another AI Client", { aiClientId: "https://evil.example.com/client.json" }],
    ["another resource", { resource: "https://other.test/api/mcp" }],
    ["another redirect URI", { redirectUri: "https://claude.ai/other" }],
    ["a Permission the Grant lacks", { permissions: ["todos:list", "todos:delete"] as const }],
  ])("asks again for %s", (_what, request) => {
    expect(remembersConsent(grant, { ...grant, ...request })).toBe(false);
  });
});
