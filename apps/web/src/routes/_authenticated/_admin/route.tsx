import { createFileRoute, redirect } from "@tanstack/react-router";

import { isAdmin } from "#/features/identity/is-admin.ts";

export const Route = createFileRoute("/_authenticated/_admin")({
  beforeLoad: ({ context }) => {
    if (!isAdmin(context.currentUser)) throw redirect({ to: "/" });
  },
});
