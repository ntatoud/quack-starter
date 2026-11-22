import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { PasswordResetRequestForm } from "#/features/identity/password-reset-request-form.tsx";

// The API client keeps the `fetch` it first saw, so one stub serves every test and each test sets its response.
let respond: (request: Request) => Response | Promise<Response>;

const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
  respond(new Request(input, init)),
);

vi.stubGlobal("fetch", fetch);

const setup = async (response: typeof respond) => {
  respond = response;
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <PasswordResetRequestForm />
    </QueryClientProvider>,
  );

  return {
    email: page.getByRole("textbox", { name: "Email" }),
    send: page.getByRole("button", { name: "Send the link" }),
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

describe("PasswordResetRequestForm", () => {
  it("sends the email as the contract spells it, then says a link was sent if an account exists", async () => {
    const requests: Array<{ url: string; body: unknown }> = [];

    const form = await setup(async (request) => {
      requests.push({ url: request.url, body: await request.json() });

      return new Response(null, { status: 202 });
    });

    await form.email.fill("  Ada@Example.COM ");
    await userEvent.keyboard("{Enter}");

    await expect
      .element(page.getByRole("status"))
      .toMatchTextContent("If an account exists for ada@example.com, we sent it a link");
    await expect.element(form.email).not.toBeInTheDocument();
    expect(requests).toEqual([
      { url: `${location.origin}/api/password-reset`, body: { email: "ada@example.com" } },
    ]);
  });

  it("reports an email the contract refuses, and sends nothing", async () => {
    const form = await setup(() => new Response(null, { status: 202 }));

    await form.email.fill("ada");
    await form.send.click();

    await expect
      .element(form.email)
      .toHaveAccessibleDescription(
        "The one you sign in with. Enter an email address, like name@example.com",
      );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("says how long to wait when too many links were asked for", async () => {
    const form = await setup(() =>
      Response.json({ _tag: "TooManyAttempts", retryAfter: 120 }, { status: 429 }),
    );

    await form.email.fill("ada@example.com");
    await form.send.click();

    await expect.poll(said).toContain("Too many attempts. Try again in 2 minutes.");
    await expect.element(form.email).toHaveValue("ada@example.com");
  });

  it("says that the link could not be sent when the API does not answer as the contract says", async () => {
    const form = await setup(() => new Response(null, { status: 500 }));

    await form.email.fill("ada@example.com");
    await form.send.click();

    await expect.poll(said).toContain("Could not send the link. Try again.");
  });
});
