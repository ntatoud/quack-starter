import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

import { PageSearch } from "#/components/page-pagination.tsx";
import { UsersPage } from "#/features/users/admin/users-page.tsx";

export const Route = createFileRoute("/_authenticated/_admin/users")({
  validateSearch: Schema.toStandardSchemaV1(PageSearch),
  component: UsersPage,
});
