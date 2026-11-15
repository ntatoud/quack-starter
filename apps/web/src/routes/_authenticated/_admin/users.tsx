import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

import { UsersPage } from "#/features/users/users-page.tsx";
import { UsersSearch } from "#/features/users/users-search.ts";

export const Route = createFileRoute("/_authenticated/_admin/users")({
  validateSearch: Schema.toStandardSchemaV1(UsersSearch),
  component: UsersPage,
});
