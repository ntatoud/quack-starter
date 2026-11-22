import { iconHref } from "@quack/brand/icon";
import appCss from "@quack/ui/globals.css?url";
import { createRootRouteWithContext } from "@tanstack/react-router";

import { currentUserQueryOptions } from "#/features/identity/current-user.ts";
import { pageTitle } from "#/features/layout/page-title.ts";
import { NotFound } from "#/features/layout/not-found.tsx";
import { RootDocument } from "#/features/layout/root-document.tsx";
import type { RouterContext } from "#/router.tsx";

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context }) => {
    return { currentUser: await context.queryClient.ensureQueryData(currentUserQueryOptions) };
  },
  // On every page, not the consent page alone: a framed sign-in page would lead to it with no new response,
  // and the User would approve under a decoy what they cannot see.
  headers: () => ({ "Content-Security-Policy": "frame-ancestors 'none'" }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: pageTitle() },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: iconHref, type: "image/svg+xml" },
    ],
  }),
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
});
