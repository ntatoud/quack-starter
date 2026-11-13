import type { User } from "@quack/contracts/identity/user";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { SignUpForm } from "#/features/identity/sign-up-form.tsx";

const password = "correct horse battery";

// The API client keeps the `fetch` it first saw, so one stub serves every test and each test sets its response.
let respond: (request: Request) => Response | Promise<Response>;
const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
  respond(new Request(input, init)),
);
vi.stubGlobal("fetch", fetch);

/** Renders the form against a stubbed network, the one edge the form does not own. */
const setup = async (response: typeof respond) => {
  respond = response;
  const signedUp: Array<User> = [];
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <SignUpForm onSignedUp={(user) => void signedUp.push(user)} />
    </QueryClientProvider>,
  );
  return {
    signedUp,
    email: page.getByRole("textbox", { name: "Email" }),
    password: page.getByLabelText("Password"),
    signUp: page.getByRole("button", { name: "Sign up" }),
  };
};

/** What the live region of the form says. */
const said = () =>
  page
    .getByRole("status")
    .elements()
    .map((status) => status.textContent);

afterEach(() => {
  fetch.mockClear();
});

describe("SignUpForm", () => {
  it("reports an email and a password the contract refuses, and sends nothing", async () => {
    const form = await setup(() => Response.json({}));

    await form.email.fill("ada");
    await form.password.fill("too short");
    await form.signUp.click();

    await expect.element(form.email).toHaveFocus();
    await expect
      .element(form.email)
      .toHaveAccessibleDescription("Enter an email address, like name@example.com");
    await expect
      .element(form.password)
      .toHaveAccessibleDescription("Password must be at least 12 characters");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends the email as the contract spells it and the password as typed, then hands over the User", async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    const form = await setup(async (request) => {
      requests.push({ url: request.url, body: await request.json() });
      return Response.json({ id: "1", email: "ada@example.com" });
    });

    await form.email.fill("  Ada@Example.COM ");
    await form.password.fill(`  ${password} `);
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => form.signedUp).toHaveLength(1);
    expect(form.signedUp[0]).toMatchObject({ id: "1", email: "ada@example.com" });
    expect(requests).toEqual([
      {
        url: `${location.origin}/api/sign-up`,
        body: { email: "ada@example.com", password: `  ${password} ` },
      },
    ]);
  });

  it("says that the email is already taken, and signs no one up", async () => {
    const form = await setup(() => Response.json({ _tag: "EmailAlreadyTaken" }, { status: 409 }));

    await form.email.fill("ada@example.com");
    await form.password.fill(password);
    await userEvent.keyboard("{Enter}");

    await expect.poll(said).toContain("A user already signed up with this email.");
    await expect.element(form.email).toHaveValue("ada@example.com");
    expect(form.signedUp).toEqual([]);
  });

  it("says that the sign-up failed when the API does not answer as the contract says", async () => {
    const form = await setup(() => new Response(null, { status: 500 }));

    await form.email.fill("ada@example.com");
    await form.password.fill(password);
    await userEvent.keyboard("{Enter}");

    await expect.poll(said).toContain("Could not sign up. Try again.");
    expect(form.signedUp).toEqual([]);
  });
});
