import appCss from "@quack/ui/globals.css?url";
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AppHeader } from "#/features/identity/app-header.tsx";
import { currentUserQueryOptions } from "#/features/identity/current-user.ts";
import type { RouterContext } from "#/router.tsx";

export const Route = createRootRouteWithContext<RouterContext>()({
  // Runs before every navigation, in the server render and in the browser, so every route knows the Current User.
  // The cache answers once it is filled: only the first navigation of a page asks the server.
  beforeLoad: async ({ context }) => ({
    currentUser: await context.queryClient.ensureQueryData(currentUserQueryOptions),
  }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Quack Starter" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => (
    <>
      <h1 className="text-2xl font-semibold">404</h1>
      <p className="text-muted-foreground">This page does not exist.</p>
    </>
  ),
  shellComponent: RootDocument,
  component: RootLayout,
});

function RootLayout() {
  const { currentUser } = Route.useRouteContext();

  return (
    <>
      <AppHeader currentUser={currentUser} />
      <main className="mx-auto max-w-xl p-6 pt-16">
        <Outlet />
      </main>
    </>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
