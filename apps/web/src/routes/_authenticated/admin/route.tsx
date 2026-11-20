import { createFileRoute, redirect } from "@tanstack/react-router";

import { isAdmin } from "#/features/identity/is-admin.ts";
import { AdminLayout } from "#/features/layout/admin/admin-layout.tsx";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ context }) => {
    if (!isAdmin(context.currentUser)) throw redirect({ to: "/app" });
  },
  component: AdminLayout,
});
