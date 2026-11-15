import appCss from "@quack/ui/globals.css?url";
import { createRootRouteWithContext } from "@tanstack/react-router";

import { currentUserQueryOptions } from "#/features/identity/current-user.ts";
import { NotFound } from "#/features/layout/not-found.tsx";
import { RootDocument } from "#/features/layout/root-document.tsx";
import type { RouterContext } from "#/router.tsx";

export const Route = createRootRouteWithContext<RouterContext>()({
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
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
});
