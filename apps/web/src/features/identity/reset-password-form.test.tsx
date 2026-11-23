import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { ResetPasswordForm } from "#/features/identity/reset-password-form.tsx";

const password = "a brand new password";

let respond: (request: Request) => Response | Promise<Response>;

const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
  respond(new Request(input, init)),
);

vi.stubGlobal("fetch", fetch);

const setup = async (response: typeof respond, token = "token-from-the-mail") => {
  respond = response;
  let resets = 0;

  const rootRoute = createRootRoute({
    component: () => <ResetPasswordForm token={token} onReset={() => void (resets += 1)} />,
  });

  await render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider
        router={createRouter({
          routeTree: rootRoute,
          history: createMemoryHistory({ initialEntries: ["/"] }),
        })}
      />
    </QueryClientProvider>,
  );

  return {
    resets: () => resets,
    password: page.getByLabelText("New password"),
    submit: page.getByRole("button", { name: "Set the new password" }),
  };
};

const said = () =>
  page
    .getByRole("status")
    .elements()
    .map((status) => status.textContent);

afterEach(() => {
  fetch.mockClear();
});

describe("ResetPasswordForm", () => {
  it("sends the token and the password as typed, then hands over", async () => {
    const requests: Array<{ url: string; body: unknown }> = [];

    const form = await setup(async (request) => {
      requests.push({ url: request.url, body: await request.json() });

      return new Response(null, { status: 204 });
    });

    await form.password.fill(` ${password} `);
    await userEvent.keyboard("{Enter}");

    await expect.poll(form.resets).toBe(1);
    expect(requests).toEqual([
      {
        url: `${location.origin}/api/password-reset/confirm`,
        body: { token: "token-from-the-mail", password: ` ${password} ` },
      },
    ]);
  });

  it("reports a password the contract refuses, and sends nothing", async () => {
    const form = await setup(() => new Response(null, { status: 204 }));

    await form.password.fill("too short");
    await form.submit.click();

    await expect
      .element(form.password)
      .toHaveAccessibleDescription("Password must be at least 12 characters");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("says that a used or expired link is no longer valid, and links to ask for a new one", async () => {
    const form = await setup(() => Response.json({ _tag: "ExpiredLink" }, { status: 410 }));

    await form.password.fill(password);
    await form.submit.click();

    await expect
      .element(page.getByText("This link has expired or was already used."))
      .toBeVisible();
    await expect
      .element(page.getByRole("link", { name: "Ask for a new link" }))
      .toHaveAttribute("href", "/forgot-password");
    await expect.element(form.password).not.toBeInTheDocument();
    expect(form.resets()).toBe(0);
  });

  it("says that the password could not be set when the API does not answer as the contract says", async () => {
    const form = await setup(() => new Response(null, { status: 500 }));

    await form.password.fill(password);
    await form.submit.click();

    await expect.poll(said).toContain("Could not set the password. Try again.");
    expect(form.resets()).toBe(0);
  });
});
