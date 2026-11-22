import { createFileRoute, redirect } from "@tanstack/react-router";
import { Schema } from "effect";

import { ResetPasswordPage } from "#/features/identity/reset-password-page.tsx";
import { ResetPasswordSearch } from "#/features/identity/reset-password-search.ts";
import { pageTitle } from "#/features/layout/page-title.ts";

export const Route = createFileRoute("/_guest/reset-password")({
  validateSearch: Schema.toStandardSchemaV1(ResetPasswordSearch),
  beforeLoad: ({ context }) => {
    if (context.currentUser !== null) throw redirect({ to: "/app" });
  },
  head: () => ({ meta: [{ title: pageTitle("Choose a new password") }] }),
  component: ResetPasswordPage,
});
