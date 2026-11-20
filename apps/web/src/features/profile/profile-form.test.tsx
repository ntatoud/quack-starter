import type { User } from "@quack/contracts/identity/user";
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

import { currentUserQueryOptions } from "#/features/identity/current-user.ts";
import { ProfileForm } from "#/features/profile/profile-form.tsx";

const ada: typeof User.Encoded = {
  id: "user-1",
  email: "ada@quack.dev",
  role: "user",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  lastSignInAt: null,
  onboardedAt: null,
  profile: null,
};

const adaProfile = {
  firstName: "Ada",
  lastName: "Lovelace",
  avatarUrl: null,
  jobTitle: "Analyst",
  team: "engineering",
  country: "GB",
} satisfies (typeof User.Encoded)["profile"];

// The API client keeps the `fetch` it first saw, so one stub serves every test and each test sets its response.
let respond: (request: Request) => Response | Promise<Response>;
const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
  respond(new Request(input, init)),
);
vi.stubGlobal("fetch", fetch);

const echo = async (request: Request) => Response.json({ ...ada, profile: await request.json() });

const setup = async (currentUser: typeof User.Encoded, response: typeof respond) => {
  respond = response;
  const queryClient = new QueryClient();
  queryClient.setQueryData(currentUserQueryOptions.queryKey, currentUser);
  const rootRoute = createRootRoute({
    component: () => <ProfileForm currentUser={currentUser} />,
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return {
    queryClient,
    firstName: page.getByRole("textbox", { name: "First name" }),
    lastName: page.getByRole("textbox", { name: "Last name" }),
    jobTitle: page.getByRole("textbox", { name: "Job title" }),
    team: page.getByRole("combobox", { name: "Team" }),
    country: page.getByRole("combobox", { name: "Country" }),
    avatarUrl: page.getByRole("textbox", { name: "Avatar" }),
    save: page.getByRole("button", { name: "Save" }),
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

describe("ProfileForm", () => {
  it("starts from the Profile of the Current User", async () => {
    const form = await setup({ ...ada, profile: adaProfile }, echo);

    await expect.element(form.firstName).toHaveValue("Ada");
    await expect.element(form.lastName).toHaveValue("Lovelace");
    await expect.element(form.jobTitle).toHaveValue("Analyst");
    await expect.poll(() => form.team.element().textContent).toContain("Engineering");
    await expect.element(form.country).toHaveValue("United Kingdom");
    await expect.element(form.avatarUrl).toHaveValue("");
    await expect.element(form.avatarUrl).toBeDisabled();
    await expect.element(form.avatarUrl).toHaveAccessibleDescription(/Not available yet/);
  });

  it("asks for the name only when there is no Profile yet, and sends nothing", async () => {
    const form = await setup(ada, echo);

    await form.save.click();

    await expect.element(form.firstName).toHaveFocus();
    await expect.element(form.firstName).toHaveAccessibleDescription(/Name is required$/);
    await expect.element(form.lastName).toHaveAccessibleDescription(/Name is required$/);
    await expect.element(form.team).not.toHaveAttribute("aria-invalid", "true");
    await expect.element(form.country).toBeValid();
    await expect.element(form.jobTitle).toBeValid();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends the Profile trimmed, and makes it the Current User's", async () => {
    const requests: Array<{ method: string; url: string; body: unknown }> = [];
    const form = await setup(ada, async (request) => {
      requests.push({
        method: request.method,
        url: request.url,
        body: await request.clone().json(),
      });
      return echo(request);
    });

    await form.firstName.fill("  Ada ");
    await form.lastName.fill("Lovelace");
    await form.team.click();
    await page.getByRole("option", { name: "Engineering" }).click();
    await form.country.fill("united k");
    await page.getByRole("option", { name: "United Kingdom" }).click();
    await form.save.click();

    await expect.poll(said).toContain("Profile saved");
    expect(requests).toEqual([
      {
        method: "PUT",
        url: `${location.origin}/api/me/profile`,
        body: { ...adaProfile, jobTitle: "" },
      },
    ]);
    expect(form.queryClient.getQueryData(currentUserQueryOptions.queryKey)).toEqual({
      ...ada,
      profile: { ...adaProfile, jobTitle: "" },
    });
  });

  it("sends no team and no country once they are emptied", async () => {
    const bodies: Array<unknown> = [];
    const form = await setup({ ...ada, profile: adaProfile }, async (request) => {
      bodies.push(await request.clone().json());
      return echo(request);
    });

    await form.team.click();
    await page.getByRole("option", { name: "No team" }).click();
    await page.getByRole("button", { name: "Clear" }).click();
    await form.save.click();

    await expect.poll(said).toContain("Profile saved");
    expect(bodies).toEqual([{ ...adaProfile, team: null, country: null }]);
  });

  it("stops saying the Profile is saved at the next edit", async () => {
    const form = await setup({ ...ada, profile: adaProfile }, echo);
    await form.save.click();
    await expect.poll(said).toContain("Profile saved");

    await form.jobTitle.fill("Countess");

    await expect.poll(said).not.toContain("Profile saved");
  });

  it("keeps what was typed when the request fails, and says so", async () => {
    const form = await setup(
      { ...ada, profile: adaProfile },
      () => new Response(null, { status: 500 }),
    );

    await form.firstName.fill("Augusta");
    await form.save.click();

    await expect
      .element(page.getByText("Could not save the profile. Try again.", { exact: true }).first())
      .toBeVisible();
    await expect.element(form.firstName).toHaveValue("Augusta");
  });
});
