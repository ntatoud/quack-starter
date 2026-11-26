import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { EmailSettingsPage } from "#/features/email-change/email-settings-page.tsx";

const password = "correct horse battery staple";

const meOf = (pendingEmail: string | null) => ({
  id: "6f9a7a52-8a39-4a8e-9d3e-1d2c3b4a5e6f",
  email: "ada@example.com",
  role: "user",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  lastSignInAt: null,
  onboardedAt: "2026-01-01T00:00:00.000Z",
  profile: null,
  timeZone: "Europe/Paris",
  pendingEmail,
});

// The API client keeps the `fetch` it first saw, so one stub serves every test and each test sets its server.
let respond: (request: Request) => Response | Promise<Response>;

const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
  respond(new Request(input, init)),
);

vi.stubGlobal("fetch", fetch);

/** A server that keeps the pending email, as the API does, and answers a request for a change with `answer`. */
const setup = async (answer: () => Response = () => new Response(null, { status: 202 })) => {
  let pendingEmail: string | null = null;
  const requests: Array<{ method: string; url: string; body: unknown }> = [];

  respond = async (request) => {
    const url = new URL(request.url).pathname;

    if (request.method === "GET") return Response.json(meOf(pendingEmail));

    const body: unknown = request.method === "POST" ? await request.json() : null;
    requests.push({ method: request.method, url, body });

    if (request.method === "DELETE") {
      pendingEmail = null;

      return new Response(null, { status: 204 });
    }

    const response = answer();

    if (response.ok) pendingEmail = (body as { newEmail: string }).newEmail;

    return response;
  };

  await render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <EmailSettingsPage />
    </QueryClientProvider>,
  );

  return {
    requests,
    newEmail: page.getByRole("textbox", { name: "New email" }),
    password: page.getByLabelText("Current password"),
    send: page.getByRole("button", { name: "Send the link" }),
    cancel: page.getByRole("button", { name: "Cancel the change" }),
  };
};

afterEach(() => {
  fetch.mockClear();
});

describe("EmailSettingsPage", () => {
  it("shows the current email, and no pending change", async () => {
    const settings = await setup();

    await expect.element(page.getByText("ada@example.com")).toBeInTheDocument();
    await expect.element(settings.cancel).not.toBeInTheDocument();
  });

  it("asks for the change as the contract spells it, then says where the link went", async () => {
    const settings = await setup();

    await settings.newEmail.fill("  New.Ada@Example.COM ");
    await settings.password.fill(password);
    await settings.send.click();

    await expect
      .element(page.getByRole("status").filter({ hasText: "Check your inbox" }))
      .toMatchTextContent("Check your inbox at new.ada@example.com");
    await expect.element(settings.newEmail).toHaveValue("");
    await expect.element(settings.password).toHaveValue("");
    expect(settings.requests).toEqual([
      {
        method: "POST",
        url: "/api/me/email-change",
        body: { newEmail: "new.ada@example.com", password },
      },
    ]);
  });

  it("cancels the pending change", async () => {
    const settings = await setup();
    await settings.newEmail.fill("new.ada@example.com");
    await settings.password.fill(password);
    await settings.send.click();

    await settings.cancel.click();

    await expect.element(settings.cancel).not.toBeInTheDocument();
    expect(settings.requests.at(-1)).toEqual({
      method: "DELETE",
      url: "/api/me/email-change",
      body: null,
    });
  });

  it("marks the current password invalid when it is wrong, and focuses it", async () => {
    const settings = await setup(() => Response.json({ _tag: "WrongPassword" }, { status: 400 }));

    await settings.newEmail.fill("new.ada@example.com");
    await settings.password.fill(password);
    await settings.send.click();

    await expect.element(settings.password).toHaveAttribute("aria-invalid", "true");
    await expect.element(settings.password).toHaveFocus();
    await expect
      .element(settings.password)
      .toHaveAccessibleDescription("To make sure it is you. This is not your current password.");
    await expect.element(settings.newEmail).not.toHaveAttribute("aria-invalid", "true");
    await expect.element(settings.cancel).not.toBeInTheDocument();
  });

  it("marks the new email invalid when an account has it, and focuses it", async () => {
    const settings = await setup(() =>
      Response.json({ _tag: "EmailAlreadyTaken" }, { status: 409 }),
    );

    await settings.newEmail.fill("grace@example.com");
    await settings.password.fill(password);
    await settings.send.click();

    await expect.element(settings.newEmail).toHaveAttribute("aria-invalid", "true");
    await expect.element(settings.newEmail).toHaveFocus();
    await expect
      .element(settings.newEmail)
      .toHaveAccessibleDescription(
        "We send it a link: your email changes once you open it. This email cannot be yours: an account has it.",
      );
  });

  it("says how long to wait when too many changes were asked for", async () => {
    const settings = await setup(() =>
      Response.json({ _tag: "TooManyAttempts", retryAfter: 120 }, { status: 429 }),
    );

    await settings.newEmail.fill("new.ada@example.com");
    await settings.password.fill(password);
    await settings.send.click();

    await expect
      .element(page.getByText("Too many attempts. Try again in 2 minutes.").first())
      .toBeVisible();
    await expect.element(settings.password).not.toHaveAttribute("aria-invalid", "true");
    await expect.element(settings.cancel).not.toBeInTheDocument();
  });
});
