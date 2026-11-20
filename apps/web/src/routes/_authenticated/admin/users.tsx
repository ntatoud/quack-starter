import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

import { UsersPage } from "#/features/users/admin/users-page.tsx";
import { UsersSearch } from "#/features/users/admin/users-search.ts";
import { pageTitle } from "#/features/layout/page-title.ts";

export const Route = createFileRoute("/_authenticated/admin/users")({
  validateSearch: Schema.toStandardSchemaV1(UsersSearch),
  head: () => ({ meta: [{ title: pageTitle("Users") }] }),
  component: UsersPage,
});
