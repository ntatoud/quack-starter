import { createFileRoute, redirect } from "@tanstack/react-router";

import { PasswordResetRequestPage } from "#/features/identity/password-reset-request-page.tsx";
import { pageTitle } from "#/features/layout/page-title.ts";

export const Route = createFileRoute("/_guest/forgot-password")({
  beforeLoad: ({ context }) => {
    if (context.currentUser !== null) throw redirect({ to: "/app" });
  },
  head: () => ({ meta: [{ title: pageTitle("Reset your password") }] }),
  component: PasswordResetRequestPage,
});
