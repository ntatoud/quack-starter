import type {
  AuthorizationRequest,
  AuthorizationRequestParams,
} from "@quack/contracts/oauth/authorization-request";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { ConsentPrompt } from "#/features/oauth/consent-prompt.tsx";

const ada = {
  id: "user-1",
  email: "ada@quack.dev",
  role: "user",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  lastSignInAt: null,
  onboardedAt: "2026-01-01T00:00:00.000Z",
  profile: null,
} as const;

const params: AuthorizationRequestParams = {
  client_id: "https://claude.ai/oauth/client.json",
  redirect_uri: "https://claude.ai/api/mcp/auth_callback",
  response_type: "code",
  code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  code_challenge_method: "S256",
  resource: "https://quack.test/api/mcp",
  scope: "todos:list todos:write todos:delete",
  state: "00123",
};

const checked = (fields: Partial<typeof AuthorizationRequest.Encoded> = {}) => ({
  aiClient: { id: "https://claude.ai/oauth/client.json", host: "claude.ai", name: "Claude" },
  redirectHost: "claude.ai",
  loopbackOnly: false,
  permissions: ["todos:list", "todos:write", "todos:delete"],
  grantablePermissions: ["todos:list", "todos:write", "todos:delete"],
  grantedPermissions: null,
  consentRemembered: false,
  csrfToken: "the-csrf-token",
  ...fields,
});

const approved =
  "https://claude.ai/api/mcp/auth_callback?code=abc&state=00123&iss=https%3A%2F%2Fquack.test";

const denied =
  "https://claude.ai/api/mcp/auth_callback?error=access_denied&state=00123&iss=https%3A%2F%2Fquack.test";

// The API client keeps the `fetch` it first saw, so one stub serves every test and each test sets its responses.
type Answers = Partial<Record<"check" | "approve" | "deny", () => Response | Promise<Response>>>;

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

const setup = async (given: Answers) => {
  answers = given;
  const onRedirect = vi.fn<(url: string) => void>();
  const onSwitchAccount = vi.fn<() => void>();
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <ConsentPrompt
        params={params}
        currentUser={ada}
        onRedirect={onRedirect}
        onSwitchAccount={onSwitchAccount}
      />
    </QueryClientProvider>,
  );

  return {
    onRedirect,
    onSwitchAccount,
    approve: page.getByRole("button", { name: "Approve" }),
    deny: page.getByRole("button", { name: "Deny" }),
  };
};

const sentence = () => page.getByRole("heading", { level: 1 });

const permission = (name: string) => page.getByRole("checkbox", { name, exact: true });

afterEach(() => {
  fetch.mockClear();
  sent.length = 0;
});

describe("ConsentPrompt", () => {
  it("says in one sentence who asks for what, and focuses it", async () => {
    await setup({ check: () => Response.json(checked()) });

    await expect
      .element(sentence())
      .toHaveTextContent("Claude, from claude.ai, wants todos:list, todos:write, and todos:delete");
    await expect.element(sentence()).toHaveFocus();
    expect(sent[0]).toEqual({ path: "/api/oauth/authorize/check", body: params });
  });

  it("names a single Permission with no list", async () => {
    await setup({ check: () => Response.json(checked({ permissions: ["todos:write"] })) });

    await expect.element(sentence()).toHaveTextContent("Claude, from claude.ai, wants todos:write");
  });

  it("names only what is new to an AI Client the User already gave a Grant", async () => {
    await setup({
      check: () => Response.json(checked({ grantedPermissions: ["todos:list"] })),
    });

    await expect
      .element(sentence())
      .toHaveTextContent("Claude, from claude.ai, now also wants todos:write and todos:delete");
  });

  it("names everything again when the request asks for nothing the Grant lacks", async () => {
    await setup({
      check: () =>
        Response.json(
          checked({
            permissions: ["todos:list"],
            grantedPermissions: ["todos:list", "todos:write"],
          }),
        ),
    });

    await expect.element(sentence()).toHaveTextContent("Claude, from claude.ai, wants todos:list");
  });

  it("offers each Permission a Grant may hold by name, those asked for ticked", async () => {
    await setup({
      check: () => Response.json(checked({ permissions: ["todos:list", "todos:write"] })),
    });

    await expect.element(page.getByRole("group", { name: "Permissions" })).toBeVisible();
    await expect.element(permission("todos:list")).toBeChecked();
    await expect.element(permission("todos:write")).toBeChecked();
    await expect.element(permission("todos:delete")).not.toBeChecked();
    await expect.element(permission("todos:list")).not.toHaveAccessibleDescription();
  });

  it("ticks what the Grant already holds too, and says which ones it holds", async () => {
    await setup({
      check: () =>
        Response.json(
          checked({ permissions: ["todos:list"], grantedPermissions: ["todos:delete"] }),
        ),
    });

    await expect.element(permission("todos:list")).toBeChecked();
    await expect.element(permission("todos:list")).toHaveAccessibleDescription("New");
    await expect.element(permission("todos:write")).not.toBeChecked();
    await expect.element(permission("todos:write")).toHaveAccessibleDescription("New");
    await expect.element(permission("todos:delete")).toBeChecked();
    await expect.element(permission("todos:delete")).toHaveAccessibleDescription("Already given");
  });

  it("approves the Permissions the User ticked, fewer or more than asked", async () => {
    const { approve } = await setup({
      check: () => Response.json(checked({ permissions: ["todos:list", "todos:write"] })),
      approve: () => Response.json({ redirectTo: approved }),
    });

    await permission("todos:write").click();
    await permission("todos:delete").click();
    await approve.click();

    await expect.poll(() => sent.at(-1)?.path).toBe("/api/oauth/authorize/approve");
    expect(sent.at(-1)?.body).toEqual({
      ...params,
      csrfToken: "the-csrf-token",
      permissions: ["todos:list", "todos:delete"],
    });
  });

  it("cannot approve nothing, but can still deny", async () => {
    const { approve, deny } = await setup({
      check: () => Response.json(checked({ permissions: ["todos:list"] })),
    });

    await permission("todos:list").click();

    await expect.element(approve).toBeDisabled();
    await expect.element(deny).toBeEnabled();
    await permission("todos:write").click();
    await expect.element(approve).toBeEnabled();
  });

  it("leads from the sentence to the Permissions, Approve, then Deny, by keyboard", async () => {
    await setup({ check: () => Response.json(checked()) });
    await expect.element(sentence()).toHaveFocus();

    for (const name of ["todos:list", "todos:write", "todos:delete"]) {
      await userEvent.tab();
      await expect.element(permission(name)).toHaveFocus();
    }

    await userEvent.tab();
    await expect.element(page.getByRole("button", { name: "Approve" })).toHaveFocus();
    await userEvent.tab();
    await expect.element(page.getByRole("button", { name: "Deny" })).toHaveFocus();
  });

  it("folds the details: the redirect host and the unverified name", async () => {
    await setup({ check: () => Response.json(checked()) });
    const details = page.getByRole("group").filter({ hasText: /^Details/ });

    await expect.element(details.getByText(/afterwards/)).not.toBeVisible();
    await page.getByText("Details").click();

    await expect.element(details).toMatchTextContent(/You go back to claude\.ai afterwards\./);
    await expect
      .element(details)
      .toMatchTextContent(
        /The name “Claude” is what the AI Client says it is\. Only claude\.ai is verified\./,
      );
  });

  it("warns inline when the AI Client runs on this machine", async () => {
    await setup({
      check: () => Response.json(checked({ loopbackOnly: true, redirectHost: "localhost" })),
    });

    await expect
      .element(page.getByRole("note"))
      .toHaveTextContent(
        "Runs on this machine. Any program on it could claim to be Claude. Approve only if you started it yourself.",
      );
  });

  it("gives no warning for an AI Client on the web", async () => {
    await setup({ check: () => Response.json(checked()) });

    await expect.element(sentence()).toBeVisible();
    expect(page.getByRole("note").elements()).toHaveLength(0);
  });

  it("approving sends the decision with the CSRF token and goes back to the AI Client", async () => {
    const { approve, onRedirect } = await setup({
      check: () => Response.json(checked()),
      approve: () => Response.json({ redirectTo: approved }),
    });

    await approve.click();

    await expect.poll(() => onRedirect.mock.calls).toEqual([[approved]]);
    expect(sent.at(-1)).toEqual({
      path: "/api/oauth/authorize/approve",
      body: {
        ...params,
        csrfToken: "the-csrf-token",
        permissions: ["todos:list", "todos:write", "todos:delete"],
      },
    });
    await expect.element(page.getByRole("status")).toHaveTextContent("Going back to Claude…");
  });

  it("denying goes back to the AI Client with the refusal", async () => {
    const { deny, onRedirect } = await setup({
      check: () => Response.json(checked()),
      deny: () => Response.json({ redirectTo: denied }),
    });

    await deny.click();

    await expect.poll(() => onRedirect.mock.calls).toEqual([[denied]]);
    expect(sent.at(-1)).toEqual({
      path: "/api/oauth/authorize/deny",
      body: { ...params, csrfToken: "the-csrf-token" },
    });
  });

  it("says when a decision could not be sent, and lets the User try again", async () => {
    const { approve, onRedirect } = await setup({ check: () => Response.json(checked()) });

    await approve.click();

    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Could not send your answer. Try again.");
    await expect.element(approve).toBeEnabled();
    expect(onRedirect).not.toHaveBeenCalled();
  });

  it("shows who is signed in, with a way to switch account", async () => {
    const { onSwitchAccount } = await setup({ check: () => Response.json(checked()) });

    const switchAccount = page.getByRole("button", { name: "Not you? Switch account" });

    await expect
      .element(page.getByText(/^Signed in as/))
      .toHaveTextContent("Signed in as ada@quack.dev. Not you? Switch account");
    await switchAccount.click();

    expect(onSwitchAccount).toHaveBeenCalledOnce();
  });

  it("shows why Quack refuses the request, with nothing to approve", async () => {
    await setup({
      check: () =>
        Response.json(
          {
            _tag: "AuthorizationRequestRefused",
            error: "invalid_request",
            error_description: "redirect_uri is not one of the AI Client's",
          },
          { status: 400 },
        ),
    });

    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent(
        "This request cannot be approvedredirect_uri is not one of the AI Client's",
      );
    expect(page.getByRole("button", { name: "Approve" }).elements()).toHaveLength(0);
  });

  it("says how long to wait when the User made Quack fetch too many documents", async () => {
    await setup({
      check: () => Response.json({ _tag: "TooManyAttempts", retryAfter: 600 }, { status: 429 }),
    });

    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Could not load the requestToo many attempts. Try again in 10 minutes.");
    expect(page.getByRole("button", { name: "Approve" }).elements()).toHaveLength(0);
  });

  it("says when the request could not be checked, and checks it again", async () => {
    let calls = 0;
    await setup({
      check: () => {
        calls += 1;

        return calls === 1 ? new Response(null, { status: 500 }) : Response.json(checked());
      },
    });

    await expect.element(page.getByRole("alert")).toMatchTextContent(/^Could not load the request/);
    await page.getByRole("button", { name: "Try again" }).click();

    await expect.element(page.getByRole("button", { name: "Approve" })).toBeVisible();
  });
});
