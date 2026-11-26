import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { ConfirmEmail } from "#/features/email-change/confirm-email.tsx";

let respond: (request: Request) => Response | Promise<Response>;

const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
  respond(new Request(input, init)),
);

vi.stubGlobal("fetch", fetch);

const setup = async (response: typeof respond) => {
  respond = response;
  let confirmed = 0;

  const rootRoute = createRootRoute({
    component: () => (
      <ConfirmEmail token="token-from-the-mail" onConfirmed={() => void (confirmed += 1)} />
    ),
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
    confirmed: () => confirmed,
    confirm: page.getByRole("button", { name: "Confirm this email" }),
  };
};

afterEach(() => {
  fetch.mockClear();
});

describe("ConfirmEmail", () => {
  it("sends the token of the link, then hands over once confirmed", async () => {
    const requests: Array<{ url: string; body: unknown }> = [];

    const form = await setup(async (request) => {
      requests.push({ url: request.url, body: await request.json() });

      return new Response(null, { status: 204 });
    });

    await form.confirm.click();

    await expect.poll(form.confirmed).toBe(1);
    expect(requests).toEqual([
      {
        url: `${location.origin}/api/email-change/confirm`,
        body: { token: "token-from-the-mail" },
      },
    ]);
  });

  it("says the link has expired, and leads to ask for a new one", async () => {
    const form = await setup(() => Response.json({ _tag: "ExpiredLink" }, { status: 410 }));

    await form.confirm.click();

    await expect
      .element(page.getByRole("status"))
      .toMatchTextContent("This link has expired or was already used");
    await expect
      .element(page.getByRole("link", { name: "Ask for a new link" }))
      .toHaveAttribute("href", "/app/settings/email");
    expect(form.confirmed()).toBe(0);
  });

  it("says another account took the email meanwhile", async () => {
    const form = await setup(() => Response.json({ _tag: "EmailAlreadyTaken" }, { status: 409 }));

    await form.confirm.click();

    await expect
      .element(page.getByRole("alert"))
      .toMatchTextContent("Another account has taken this email since you asked for it.");
    expect(form.confirmed()).toBe(0);
  });
});
