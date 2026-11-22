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

import { PageHeader } from "#/features/layout/page-header.tsx";

const renderAt = async (path: string) => {
  const rootRoute = createRootRoute({
    component: () => (
      <SidebarProvider>
        <Outlet />
      </SidebarProvider>
    ),
  });

  const routes = [
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/app",
      component: () => <PageHeader title="Todos" />,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/admin/users",
      component: () => <PageHeader title="Users" />,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/app/settings/profile",
      component: () => <PageHeader title="Profile" trail={[{ label: "Settings" }]} back />,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/admin/users/details",
      component: () => (
        <PageHeader title="Details" trail={[{ label: "Users", to: "/admin/users" }]} />
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
  it("titles the page without a breadcrumb when no page leads to it", async () => {
    await renderAt("/app");

    await expect.element(page.getByRole("heading", { level: 1, name: "Todos" })).toBeVisible();
    expect(page.getByRole("navigation").elements()).toEqual([]);
    expect(page.getByRole("button", { name: "Back" }).elements()).toEqual([]);
  });

  it("puts the title of the page after its trail, as a heading that is no link", async () => {
    await renderAt("/app/settings/profile");

    const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" });
    await expect.element(breadcrumb.getByText("Settings")).toBeVisible();
    expect(breadcrumb.getByRole("link").elements()).toEqual([]);
    const title = breadcrumb.getByRole("heading", { level: 1, name: "Profile" });
    await expect.element(title).toHaveAttribute("aria-current", "page");
    expect(title.getByRole("link").elements()).toEqual([]);
  });

  it("links a page of the trail that has a link", async () => {
    await renderAt("/admin/users/details");

    const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" });
    await expect
      .element(breadcrumb.getByRole("link", { name: "Users" }))
      .toHaveAttribute("href", "/admin/users");
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
