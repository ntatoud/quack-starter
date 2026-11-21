import type { Role } from "@quack/contracts/identity/user";
import { SidebarProvider } from "@quack/ui/components/sidebar";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { ComponentType } from "react";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import type { SidebarProps } from "#/features/layout/sidebar-layout.tsx";
import type { PreferenceValues } from "#/features/preferences/preferences.ts";
import { testProviders } from "#/testing/test-providers.tsx";

export const renderSidebar = async (
  Sidebar: ComponentType<SidebarProps>,
  role: Role,
  preferences: Partial<PreferenceValues> = {},
) => {
  // Below the breakpoint of `useIsMobile`, the sidebar is a closed sheet.
  await page.viewport(1280, 800);
  const rootRoute = createRootRoute({
    component: () => (
      <SidebarProvider>
        <Sidebar
          currentUser={{
            id: "user-1",
            email: "someone@quack.dev",
            role,
            status: "active",
            createdAt: "2026-01-01T00:00:00.000Z",
            lastSignInAt: null,
            onboardedAt: "2026-01-01T00:00:00.000Z",
            profile: null,
          }}
        />
      </SidebarProvider>
    ),
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const providers = testProviders(preferences);
  const { Providers } = providers;
  await render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  return providers;
};
