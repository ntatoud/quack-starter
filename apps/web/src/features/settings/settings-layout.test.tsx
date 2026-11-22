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

import { SettingsLayout } from "#/features/settings/settings-layout.tsx";
import type { PreferenceValues } from "#/features/preferences/preferences.ts";
import { testProviders } from "#/testing/test-providers.tsx";

const setup = async (path: string, preferences: Partial<PreferenceValues> = {}) => {
  await page.viewport(1280, 800);
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
  const section = (name: string) =>
    createRoute({
      getParentRoute: () => settings,
      path: name.toLowerCase(),
      component: () => <p>The {name} section</p>,
    });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      settings.addChildren([section("Profile"), section("Preferences")]),
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

  it("leads from one section to another", async () => {
    const { profile } = await setup("/app/settings/preferences");

    await profile.click();

    await expect.element(page.getByText("The Profile section")).toBeVisible();
    await expect.element(page.getByRole("heading", { level: 1 })).toHaveTextContent("Profile");
    await expect.element(profile).toHaveAttribute("aria-current", "page");
  });

  it.each([false, true])(
    "puts its menu on the left of the section, level with its top, right sidebar %s",
    async (isRightSidebar) => {
      const { navBox, sectionBox } = await setup("/app/settings/profile", {
        "right-sidebar": isRightSidebar,
      });

      await expect.poll(() => navBox().left < sectionBox().left).toBe(true);
      expect(navBox().top).toBe(sectionBox().top);
    },
  );
});
