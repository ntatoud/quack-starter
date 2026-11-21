import { DataTable, type DataTableColumn } from "@quack/ui/components/data-table/data-table";
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
import { testProviders } from "#/testing/test-providers.tsx";

const columns: ReadonlyArray<DataTableColumn<{ id: string }>> = Array.from(
  { length: 12 },
  (_, i) => ({ id: `column-${i}`, header: `A rather long header ${i}`, cell: () => "value" }),
);

const setup = async (width: number) => {
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
        role: "admin" as const,
      },
    }),
  });
  const app = createRoute({
    getParentRoute: () => authenticated,
    path: "app",
    component: AppLayout,
  });
  const wide = createRoute({
    getParentRoute: () => app,
    path: "/",
    component: () => <DataTable columns={columns} data={[{ id: "1" }]} />,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([authenticated.addChildren([app.addChildren([wide])])]),
    history: createMemoryHistory({ initialEntries: ["/app"] }),
  });
  const { Providers } = testProviders();
  await render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
};

describe("AppLayout", () => {
  it.each([1280, 375])(
    "keeps a page wider than the window inside it, at %ipx: the table scrolls, not the window",
    async (width) => {
      await setup(width);
      await expect.element(page.getByRole("table")).toBeVisible();

      expect(document.documentElement.scrollWidth).toBe(window.innerWidth);
      const viewport = page
        .getByRole("table")
        .element()
        .closest("[data-slot=scroll-area-viewport]");
      if (!(viewport instanceof HTMLElement)) throw new Error("The table scrolls in no viewport.");
      expect(viewport.scrollWidth).toBeGreaterThan(viewport.clientWidth);
      expect(viewport.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth);
    },
  );
});
