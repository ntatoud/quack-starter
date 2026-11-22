import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  authorizationParamsOf,
  rememberedConsentRedirect,
} from "#/features/oauth/authorization-check.ts";

const params = authorizationParamsOf(
  "?client_id=https%3A%2F%2Fclaude.ai%2Foauth%2Fclient.json&state=1e3&scope=todos%3Alist&other=x",
);

const checked = (consentRemembered: boolean) => ({
  aiClient: { id: "https://claude.ai/oauth/client.json", host: "claude.ai", name: "Claude" },
  redirectHost: "claude.ai",
  loopbackOnly: false,
  permissions: ["todos:list"],
  grantedPermissions: ["todos:list"],
  consentRemembered,
  csrfToken: "the-csrf-token",
});

const approved = "https://claude.ai/api/mcp/auth_callback?code=abc&state=1e3";

// The API client keeps the `fetch` it first saw, so one stub serves every test and each test sets its responses.
type Answers = Partial<Record<"check" | "approve", () => Response>>;

let answers: Answers;
const sent: Array<{ readonly path: string; readonly body: unknown }> = [];

const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = new Request(input, init);
  const path = new URL(request.url).pathname;
  sent.push({ path, body: await request.clone().json() });
  const answer = answers[path.split("/").at(-1) as keyof Answers];

  return answer === undefined ? new Response(null, { status: 500 }) : answer();
});

vi.stubGlobal("fetch", fetch);

const redirectFor = (given: Answers) => {
  answers = given;

  return rememberedConsentRedirect(new QueryClient(), params);
};

afterEach(() => {
  sent.length = 0;
});

describe("authorizationParamsOf", () => {
  it("keeps the parameters of an authorization request as written, and only those", () => {
    expect(params).toEqual({
      client_id: "https://claude.ai/oauth/client.json",
      state: "1e3",
      scope: "todos:list",
    });
  });
});

describe("rememberedConsentRedirect", () => {
  it("approves at once when Quack remembers the consent, and leads back to the AI Client", async () => {
    expect(
      await redirectFor({
        check: () => Response.json(checked(true)),
        approve: () => Response.json({ redirectTo: approved }),
      }),
    ).toBe(approved);
    expect(sent.at(-1)).toEqual({
      path: "/api/oauth/authorize/approve",
      body: { ...params, csrfToken: "the-csrf-token" },
    });
  });

  it("leaves the page to ask when Quack does not remember the consent", async () => {
    expect(await redirectFor({ check: () => Response.json(checked(false)) })).toBeUndefined();
    expect(sent.map(({ path }) => path)).toEqual(["/api/oauth/authorize/check"]);
  });

  it("leaves the page to ask when the approval fails, and to show a check that fails", async () => {
    expect(await redirectFor({ check: () => Response.json(checked(true)) })).toBeUndefined();
    expect(await redirectFor({})).toBeUndefined();
  });
});
