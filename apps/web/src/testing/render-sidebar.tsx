import { type Role, User } from "@quack/contracts/identity/user";
import { SidebarProvider } from "@quack/ui/components/sidebar";
import { TooltipProvider } from "@quack/ui/components/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { Schema } from "effect";
import type { ComponentType } from "react";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import type { SidebarProps } from "#/features/layout/sidebar-layout.tsx";

export const renderSidebar = async (Sidebar: ComponentType<SidebarProps>, role: Role) => {
  // Below the breakpoint of `useIsMobile`, the sidebar is a closed sheet.
  await page.viewport(1280, 800);
  const rootRoute = createRootRoute({
    component: () => (
      <TooltipProvider>
        <SidebarProvider>
          <Sidebar
            currentUser={Schema.decodeSync(User)({
              id: "user-1",
              email: "someone@quack.dev",
              role,
              status: "active",
              createdAt: "2026-01-01T00:00:00.000Z",
              lastSignInAt: null,
              onboardedAt: "2026-01-01T00:00:00.000Z",
              profile: null,
            })}
          />
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
