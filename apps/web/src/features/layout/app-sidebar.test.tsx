import { SidebarProvider } from "@quack/ui/components/sidebar";
import { TooltipProvider } from "@quack/ui/components/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { AppSidebar } from "#/features/layout/app-sidebar.tsx";

const setup = async (role: "user" | "admin") => {
  // Below the breakpoint of `useIsMobile`, the sidebar is a closed sheet.
  await page.viewport(1280, 800);
  const rootRoute = createRootRoute({
    component: () => (
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar currentUser={{ id: "user-1", email: "someone@quack.dev", role }} />
        </SidebarProvider>
      </TooltipProvider>
    ),
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

describe("AppSidebar", () => {
  it("links to the users for an admin", async () => {
    await setup("admin");

    await expect.element(page.getByRole("link", { name: "Users" })).toBeVisible();
  });

  it("does not link to the users for another user", async () => {
    await setup("user");

    await expect.element(page.getByRole("link", { name: "Todos" })).toBeVisible();
    expect(page.getByRole("link", { name: "Users" }).elements()).toEqual([]);
  });
});
