import { createFileRoute, redirect } from "@tanstack/react-router";

import { signInLocation } from "#/features/identity/redirect-target.ts";
import { readSidebarOpen } from "#/features/layout/sidebar-open.ts";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ context, location }) => {
    if (context.currentUser === null) {
      throw redirect(signInLocation(location.href));
    }
    return { currentUser: context.currentUser, sidebarOpen: readSidebarOpen() };
  },
});
