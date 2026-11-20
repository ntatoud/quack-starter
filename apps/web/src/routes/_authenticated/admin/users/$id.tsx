import { createFileRoute } from "@tanstack/react-router";

import { pageTitle } from "#/features/layout/page-title.ts";
import { UserPage } from "#/features/users/admin/user-page.tsx";

export const Route = createFileRoute("/_authenticated/admin/users/$id")({
  head: () => ({ meta: [{ title: pageTitle("User", "Users") }] }),
  component: UserPage,
});
