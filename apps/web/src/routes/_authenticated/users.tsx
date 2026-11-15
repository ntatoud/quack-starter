import { createFileRoute, redirect } from "@tanstack/react-router";
import { Schema } from "effect";

import { UsersPage } from "#/features/users/users-page.tsx";
import { UsersSearch } from "#/features/users/users-search.ts";

export const Route = createFileRoute("/_authenticated/users")({
  validateSearch: Schema.toStandardSchemaV1(UsersSearch),
  beforeLoad: ({ context }) => {
    if (context.currentUser.role !== "admin") throw redirect({ to: "/" });
  },
  component: UsersPage,
});
