import { SidebarProvider } from "@quack/ui/components/sidebar";
import { TooltipProvider } from "@quack/ui/components/tooltip";
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

import { PageHeader } from "#/features/layout/page-header.tsx";

const renderAt = async (path: string) => {
  const rootRoute = createRootRoute({
    component: () => (
      <TooltipProvider>
        <SidebarProvider>
          <Outlet />
        </SidebarProvider>
      </TooltipProvider>
    ),
  });
  const routes = [
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/app",
      component: () => <PageHeader crumbs={[{ label: "Todos" }]} />,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/admin/users",
      component: () => <PageHeader crumbs={[{ label: "Users" }]} />,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/app/settings/profile",
      component: () => (
        <PageHeader crumbs={[{ label: "Settings", to: "/app" }, { label: "Profile" }]} back />
      ),
    }),
  ];
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await render(<RouterProvider router={router} />);
  return router;
};

describe("PageHeader", () => {
  it("titles the page with its only crumb, without a breadcrumb", async () => {
    await renderAt("/app");

    await expect.element(page.getByRole("heading", { level: 1, name: "Todos" })).toBeVisible();
    expect(page.getByRole("navigation").elements()).toEqual([]);
    expect(page.getByRole("button", { name: "Back" }).elements()).toEqual([]);
  });

  it("leads to the page through its breadcrumb, the page last as its title", async () => {
    await renderAt("/app/settings/profile");

    const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" });
    await expect
      .element(breadcrumb.getByRole("link", { name: "Settings" }))
      .toHaveAttribute("href", "/app");
    await expect
      .element(breadcrumb.getByRole("heading", { level: 1, name: "Profile" }))
      .toBeVisible();
  });

  it("goes back to the page before", async () => {
    const router = await renderAt("/admin/users");
    await router.navigate({ to: "/app/settings/profile" });

    await page.getByRole("button", { name: "Back" }).click();

    await expect.poll(() => router.state.location.pathname).toBe("/admin/users");
  });

  it("goes to the app when it was opened on this page", async () => {
    const router = await renderAt("/app/settings/profile");

    await page.getByRole("button", { name: "Back" }).click();

    await expect.poll(() => router.state.location.pathname).toBe("/app");
  });
});
