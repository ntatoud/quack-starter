import { createFileRoute } from "@tanstack/react-router";

import { PasswordResetRequestPage } from "#/features/identity/password-reset-request-page.tsx";
import { pageTitle } from "#/features/layout/page-title.ts";

export const Route = createFileRoute("/_guest/forgot-password")({
  head: () => ({ meta: [{ title: pageTitle("Reset your password") }] }),
  component: PasswordResetRequestPage,
});
