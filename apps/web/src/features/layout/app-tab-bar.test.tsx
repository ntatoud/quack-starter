import type { Role } from "@quack/contracts/identity/user";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { AppLayout } from "#/features/layout/app-layout.tsx";
import { PageHeader } from "#/features/layout/page-header.tsx";
import { testProviders } from "#/testing/test-providers.tsx";

const setup = async ({ width, role, path }: { width: number; role: Role; path: string }) => {
  await page.viewport(width, 800);
  const rootRoute = createRootRoute();

  const authenticated = createRoute({
    getParentRoute: () => rootRoute,
    id: "_authenticated",
    beforeLoad: () => ({
      sidebarOpen: true,
      currentUser: {
        id: "user-1",
        email: "someone@quack.dev",
        role,
        status: "active" as const,
        createdAt: "2026-01-01T00:00:00.000Z",
        lastSignInAt: null,
        onboardedAt: "2026-01-01T00:00:00.000Z",
        timeZone: "Europe/Paris",
        profile: null,
      },
    }),
  });

  const app = createRoute({
    getParentRoute: () => authenticated,
    path: "app",
    component: AppLayout,
  });

  const todos = createRoute({
    getParentRoute: () => app,
    path: "/",
    component: () => <PageHeader title="Todos" />,
  });

  const settings = createRoute({
    getParentRoute: () => app,
    path: "settings/profile",
    component: () => <PageHeader title="Profile" />,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      authenticated.addChildren([app.addChildren([todos, settings])]),
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  const { Providers } = testProviders();
  await render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );

  return page.getByRole("navigation", { name: "Main" });
};

describe("AppTabBar", () => {
  it("leads a phone to the pages of the app from the bottom of the screen, with no sidebar to open", async () => {
    const tabBar = await setup({ width: 375, role: "user", path: "/app" });

    await expect
      .element(tabBar.getByRole("link", { name: "Today" }))
      .toHaveAttribute("href", "/app/today");
    await expect.element(tabBar.getByRole("link", { name: "Todos" })).toBeVisible();
    await expect
      .element(tabBar.getByRole("link", { name: "Settings" }))
      .toHaveAttribute("href", "/app/settings");
    expect(page.getByRole("link", { name: "Administration" }).elements()).toEqual([]);
    expect(page.getByRole("button", { name: "Toggle Sidebar" }).elements()).toEqual([]);
    const { bottom } = tabBar.element().getBoundingClientRect();
    expect(bottom).toBe(window.innerHeight);
  });

  it("leads an Admin to the administration from the top bar, out of the tabs", async () => {
    const tabBar = await setup({ width: 375, role: "admin", path: "/app" });

    const administration = page.getByRole("link", { name: "Administration" });
    await expect.element(administration).toHaveAttribute("href", "/admin");
    expect(administration.element().closest("header")).not.toBeNull();
    expect(administration.element().getBoundingClientRect().right).toBeGreaterThan(
      window.innerWidth - 24,
    );
    expect(tabBar.getByRole("link").elements()).toHaveLength(3);
  });

  it("keeps the administration in the sidebar on a wider screen", async () => {
    await setup({ width: 1280, role: "admin", path: "/app" });

    await expect.element(page.getByRole("heading", { name: "Todos" })).toBeVisible();

    const inHeader = page
      .getByRole("link", { name: "Administration" })
      .elements()
      .filter((link) => link.closest("header") !== null);

    expect(inHeader).toEqual([]);
  });

  it.each([
    ["/app", "Todos", "Settings"],
    ["/app/settings/profile", "Settings", "Todos"],
  ])("marks the tab of %s as the current page", async (path, current, other) => {
    const tabBar = await setup({ width: 375, role: "user", path });

    await expect
      .element(tabBar.getByRole("link", { name: current }))
      .toHaveAttribute("aria-current", "page");
    await expect
      .element(tabBar.getByRole("link", { name: other }))
      .not.toHaveAttribute("aria-current");
  });

  it("gives way to the sidebar on a wider screen", async () => {
    const tabBar = await setup({ width: 1280, role: "user", path: "/app" });

    await expect.element(page.getByRole("heading", { name: "Todos" })).toBeVisible();
    expect(tabBar.elements()).toEqual([]);
  });
});
