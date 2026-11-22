import { SidebarProvider } from "@quack/ui/components/sidebar";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { SettingsHome } from "#/features/settings/settings-home.tsx";
import { SettingsLayout } from "#/features/settings/settings-layout.tsx";
import type { PreferenceValues } from "#/features/preferences/preferences.ts";
import { testProviders } from "#/testing/test-providers.tsx";

const setup = async (path: string, preferences: Partial<PreferenceValues> = {}, width = 1280) => {
  await page.viewport(width, 800);

  const rootRoute = createRootRoute({
    component: () => (
      <SidebarProvider>
        <Outlet />
      </SidebarProvider>
    ),
  });

  const settings = createRoute({
    getParentRoute: () => rootRoute,
    path: "/app/settings",
    component: SettingsLayout,
  });

  const section = (name: string, segment = name.toLowerCase()) =>
    createRoute({
      getParentRoute: () => settings,
      path: segment,
      component: () => <p>The {name} section</p>,
    });

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      settings.addChildren([
        createRoute({ getParentRoute: () => settings, path: "/", component: SettingsHome }),
        section("Profile"),
        section("Preferences"),
        section("AI Clients", "ai-clients"),
      ]),
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  const { Providers } = testProviders(preferences);
  await render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  const nav = page.getByRole("navigation", { name: "Settings" });

  return {
    router,
    profile: nav.getByRole("link", { name: "Profile" }),
    preferences: nav.getByRole("link", { name: "Preferences" }),
    navBox: () => nav.element().getBoundingClientRect(),
    sectionBox: () =>
      page
        .getByText(/section$/)
        .element()
        .getBoundingClientRect(),
  };
};

describe("SettingsLayout", () => {
  it("names the section shown, and marks it in the navigation", async () => {
    const { profile, preferences } = await setup("/app/settings/preferences");

    await expect.element(page.getByRole("heading", { level: 1 })).toHaveTextContent("Preferences");
    await expect.element(page.getByText("The Preferences section")).toBeVisible();
    await expect.element(preferences).toHaveAttribute("aria-current", "page");
    await expect.element(profile).not.toHaveAttribute("aria-current");
  });

  it("lists the AI Clients next to the Profile and the Preferences", async () => {
    await setup("/app/settings/ai-clients");
    const nav = page.getByRole("navigation", { name: "Settings" });

    await expect.element(page.getByText("The AI Clients section")).toBeVisible();
    expect(
      nav
        .getByRole("link")
        .elements()
        .map((link) => link.textContent),
    ).toEqual(["Profile", "Preferences", "AI Clients"]);
    await expect
      .element(nav.getByRole("link", { name: "AI Clients" }))
      .toHaveAttribute("aria-current", "page");
  });

  it("leads from one section to another", async () => {
    const { profile } = await setup("/app/settings/preferences");

    await profile.click();

    await expect.element(page.getByText("The Profile section")).toBeVisible();
    await expect.element(page.getByRole("heading", { level: 1 })).toHaveTextContent("Profile");
    await expect.element(profile).toHaveAttribute("aria-current", "page");
  });

  it.each(["left", "right"] as const)(
    "puts its menu on the left of the section, level with its top, sidebar on the %s",
    async (sidebarSide) => {
      const { navBox, sectionBox } = await setup("/app/settings/profile", { sidebarSide });

      await expect.poll(() => navBox().left < sectionBox().left).toBe(true);
      expect(navBox().top).toBe(sectionBox().top);
    },
  );

  it("shows the first section next to the menu on a wide screen, rather than the list a phone gets", async () => {
    const { router } = await setup("/app/settings");

    await expect.element(page.getByText("The Profile section")).toBeVisible();
    expect(router.state.location.pathname).toBe("/app/settings/profile");
  });

  describe("on a phone", () => {
    it("lists the sections, and the way to sign out", async () => {
      const { router, profile } = await setup("/app/settings", {}, 375);

      await expect.element(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
      await expect.element(page.getByRole("button", { name: "Sign out" })).toBeVisible();
      expect(router.state.location.pathname).toBe("/app/settings");

      await profile.click();

      await expect.element(page.getByText("The Profile section")).toBeVisible();
      expect(page.getByRole("navigation", { name: "Settings" }).elements()).toEqual([]);
      await expect.element(page.getByRole("button", { name: "Back" })).toBeVisible();
    });
  });
});
