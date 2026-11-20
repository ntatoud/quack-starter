import { devAccounts, devPassword } from "@quack/contracts/identity/dev-accounts";
import type { User } from "@quack/contracts/identity/user";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { DevQuickSignIn } from "#/features/identity/dev-quick-sign-in.tsx";

// The API client keeps the `fetch` it first saw, so one stub serves every test and each test sets its response.
let respond: (request: Request) => Response | Promise<Response>;
const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
  respond(new Request(input, init)),
);
vi.stubGlobal("fetch", fetch);

const setup = async (response: typeof respond) => {
  respond = response;
  const signedIn: Array<User> = [];
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <DevQuickSignIn onSignedIn={(user) => void signedIn.push(user)} />
    </QueryClientProvider>,
  );
  return signedIn;
};

afterEach(() => {
  fetch.mockClear();
});

describe("DevQuickSignIn", () => {
  it("signs in as the seeded account of the Role", async () => {
    const requests: Array<unknown> = [];
    const signedIn = await setup(async (request) => {
      requests.push(await request.json());
      return Response.json({
        id: "1",
        email: devAccounts.admin,
        role: "admin",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        lastSignInAt: null,
        emailVerifiedAt: null,
        profile: null,
      });
    });

    await page.getByRole("button", { name: "As admin" }).click();

    await expect.poll(() => signedIn.map(({ email }) => email)).toEqual([devAccounts.admin]);
    expect(requests).toEqual([{ email: devAccounts.admin, password: devPassword }]);
  });

  it("says when the account is not seeded", async () => {
    const signedIn = await setup(() =>
      Response.json({ _tag: "InvalidCredentials" }, { status: 401 }),
    );

    await page.getByRole("button", { name: "As user" }).click();

    await expect
      .poll(() =>
        page
          .getByRole("alert")
          .elements()
          .map((alert) => alert.textContent),
      )
      .toEqual(["Could not sign in. Are the dev accounts in the database?"]);
    expect(signedIn).toEqual([]);
  });
});
