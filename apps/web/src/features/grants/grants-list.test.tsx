import type { Grant } from "@quack/contracts/grants/grant";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { GrantsList } from "#/features/grants/grants-list.tsx";

const hour = 60 * 60 * 1000;
const day = 24 * hour;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const ahead = (ms: number) => new Date(Date.now() + ms).toISOString();

const grant = (
  id: string,
  name: string,
  fields: Partial<typeof Grant.Encoded> = {},
): typeof Grant.Encoded => ({
  id,
  aiClient: { id: `https://${id}.example.com/client.json`, host: `${id}.example.com`, name },
  loopbackOnly: false,
  permissions: ["todos:list"],
  lastUsedAt: ago(2 * hour),
  expiresAt: ahead(29 * day),
  ...fields,
});

const claude = grant("claude", "Claude", {
  permissions: ["todos:list", "todos:write", "todos:delete"],
});

const agent = grant("agent", "My Agent", { loopbackOnly: true, lastUsedAt: null });

const chatgpt = grant("chatgpt", "ChatGPT", {
  lastUsedAt: ago(26 * day),
  // An hour over: the days are rounded, and the test takes some time.
  expiresAt: ahead(3 * day + hour),
});

// The API client keeps the `fetch` it first saw, so one stub serves every test and each test sets its response.
let respond: (request: Request) => Response | Promise<Response>;

const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
  respond(new Request(input, init)),
);

vi.stubGlobal("fetch", fetch);

const setup = async (response: typeof respond) => {
  respond = response;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={queryClient}>
      <GrantsList />
    </QueryClientProvider>,
  );
};

/** Answers the Grants listed, and removes a Grant on its DELETE. */
const serving = (...grants: Array<ReturnType<typeof grant>>) => {
  const listed = [...grants];

  return (request: Request) => {
    if (request.method === "GET") return Response.json(listed);
    const id = new URL(request.url).pathname.split("/").at(-1);
    listed.splice(
      listed.findIndex((each) => each.id === id),
      1,
    );

    return new Response(null, { status: 204 });
  };
};

const group = (name: string) => page.getByRole("region", { name });

const entry = (name: string) => page.getByRole("listitem", { name });

afterEach(() => {
  fetch.mockClear();
});

describe("GrantsList", () => {
  it("says it is loading while the Grants are on their way", async () => {
    const response = Promise.withResolvers<Response>();
    await setup(() => response.promise);

    await expect.element(page.getByRole("status")).toHaveTextContent("Loading AI Clients…");
    response.resolve(Response.json([]));
  });

  it("explains how an AI Client gets access when none has any", async () => {
    await setup(() => Response.json([]));

    await expect.element(page.getByText("No AI Client can act for you yet")).toBeVisible();
    await expect
      .element(page.getByText(`${window.location.origin}/api/mcp`, { exact: true }))
      .toBeVisible();
    await expect.element(page.getByText(/then approve/)).toBeVisible();
  });

  it("puts the Grants that need a look above the active ones, each saying why", async () => {
    await setup(serving(claude, agent, chatgpt));

    await expect.element(group("Needs a look")).toBeVisible();

    const headings = page
      .getByRole("heading", { level: 2 })
      .elements()
      .map((heading) => heading.textContent);

    expect(headings).toEqual(["Needs a look", "Active"]);

    const flagged = group("Needs a look").getByRole("listitem", { name: /./ });
    expect(flagged.elements().map((each) => each.getAttribute("aria-label"))).toEqual([
      "My Agent",
      "ChatGPT",
    ]);
    await expect
      .element(entry("My Agent").getByText("Runs on this machine", { exact: true }))
      .toBeVisible();
    await expect
      .element(entry("ChatGPT").getByText("Expires in 3 days if unused", { exact: true }))
      .toBeVisible();

    await expect.element(group("Active").getByRole("listitem", { name: "Claude" })).toBeVisible();
    expect(
      entry("Claude")
        .getByText(/Runs on this machine|Expires/)
        .elements(),
    ).toEqual([]);
  });

  it("says a Grant expired, rather than when, once its end is past", async () => {
    await setup(serving(grant("gone", "Gone", { expiresAt: ago(2 * 60 * 1000) })));

    await expect.element(entry("Gone").getByText("Expired", { exact: true })).toBeVisible();
  });

  it("shows only the active group when no Grant needs a look", async () => {
    await setup(serving(claude));

    await expect.element(group("Active")).toBeVisible();
    expect(group("Needs a look").elements()).toEqual([]);
  });

  it("shows who each AI Client says it is, where it is verified to come from, and when it was used", async () => {
    await setup(serving(claude, agent));

    await expect.element(entry("Claude")).toMatchTextContent(/Claude\s*from claude\.example\.com/);
    await expect.element(entry("Claude").getByText("Used 2 hours ago")).toBeVisible();
    await expect.element(entry("My Agent").getByText("Never used yet")).toBeVisible();
  });

  it("names each Permission as the consent page does, deleting in the destructive style", async () => {
    await setup(serving(claude));
    await expect.element(entry("Claude")).toBeVisible();

    const badges = entry("Claude").getByRole("list", { name: "Permissions" }).getByRole("listitem");
    expect(badges.elements().map((badge) => badge.textContent)).toEqual([
      "todos:list",
      "todos:write",
      "todos:delete",
    ]);
    expect(
      entry("Claude")
        .getByText("todos:delete")
        .element()
        .closest("[data-variant]")
        ?.getAttribute("data-variant"),
    ).toBe("destructive");
    expect(
      entry("Claude")
        .getByText("todos:list")
        .element()
        .closest("[data-variant]")
        ?.getAttribute("data-variant"),
    ).not.toBe("destructive");
  });

  it("offers to revoke each AI Client on its own, and never all at once", async () => {
    await setup(serving(claude, agent));

    await expect.element(page.getByRole("button", { name: "Revoke Claude" })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Revoke My Agent" })).toBeVisible();
    expect(page.getByRole("button", { name: /all/i }).elements()).toEqual([]);
  });

  it("asks before revoking, stating the consequence, and keeps the access on cancel", async () => {
    await setup(serving(claude));
    const revoke = page.getByRole("button", { name: "Revoke Claude" });

    await revoke.click();

    const dialog = page.getByRole("alertdialog", { name: "Revoke Claude's access?" });
    await expect.element(dialog).toBeVisible();
    await expect
      .element(dialog)
      .toHaveAccessibleDescription(
        "Claude loses todos:list, todos:write, and todos:delete at once. To act for you again, it has to ask for your consent.",
      );
    await expect.element(dialog.getByRole("button", { name: "Keep access" })).toHaveFocus();

    await userEvent.keyboard("{Escape}");

    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(revoke).toHaveFocus();
    expect(fetch.mock.calls.filter(([, init]) => init?.method === "DELETE")).toEqual([]);
  });

  it("revokes the Grant on confirm, and lists it no more", async () => {
    await setup(serving(claude, agent));

    await page.getByRole("button", { name: "Revoke Claude" }).click();
    await page.getByRole("button", { name: "Revoke access" }).click();

    await expect.element(entry("Claude")).not.toBeInTheDocument();
    await expect.element(entry("My Agent")).toBeVisible();

    const deleted = fetch.mock.calls
      .map(([input, init]) => new Request(input, init))
      .filter((request) => request.method === "DELETE");

    expect(deleted.map((request) => new URL(request.url).pathname)).toEqual(["/api/grants/claude"]);
  });

  it("moves focus to the next AI Client once one is revoked, so it is not lost", async () => {
    await setup(serving(agent, claude));

    await page.getByRole("button", { name: "Revoke My Agent" }).click();
    await page.getByRole("button", { name: "Revoke access" }).click();

    await expect.element(entry("My Agent")).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Revoke Claude" })).toHaveFocus();
  });

  it("says when a Grant cannot be revoked, and keeps it", async () => {
    await setup((request) =>
      request.method === "GET" ? Response.json([claude]) : new Response(null, { status: 500 }),
    );

    await page.getByRole("button", { name: "Revoke Claude" }).click();
    await page.getByRole("button", { name: "Revoke access" }).click();

    const dialog = page.getByRole("alertdialog");
    await expect
      .element(dialog.getByRole("alert"))
      .toHaveTextContent("Could not revoke Claude. Try again.");
    await userEvent.keyboard("{Escape}");
    await expect.element(entry("Claude")).toBeVisible();
  });

  it("offers to try again when the Grants cannot be loaded", async () => {
    await setup(() => new Response(null, { status: 500 }));

    await expect
      .element(page.getByRole("alert").getByText("Could not load your AI Clients"))
      .toBeVisible();

    respond = serving(claude);
    await page.getByRole("button", { name: "Try again" }).click();

    await expect.element(entry("Claude")).toBeVisible();
  });
});
