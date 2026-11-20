import { User } from "@quack/contracts/identity/user";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Schema } from "effect";

import { AuthenticatedLayout } from "#/features/layout/authenticated-layout.tsx";
import { signInLocation } from "#/features/identity/redirect-target.ts";
import { readSidebarOpen } from "#/features/layout/sidebar-open.ts";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ context, location }) => {
    if (context.currentUser === null) {
      throw redirect(signInLocation(location.href));
    }
    return {
      currentUser: Schema.decodeSync(User)(context.currentUser),
      sidebarOpen: readSidebarOpen(),
    };
  },
  component: AuthenticatedLayout,
});
