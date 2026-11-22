import { createFileRoute, redirect } from "@tanstack/react-router";

import { ForgotPasswordPage } from "#/features/identity/forgot-password-page.tsx";
import { pageTitle } from "#/features/layout/page-title.ts";

export const Route = createFileRoute("/_guest/forgot-password")({
  beforeLoad: ({ context }) => {
    if (context.currentUser !== null) throw redirect({ to: "/app" });
  },
  head: () => ({ meta: [{ title: pageTitle("Reset your password") }] }),
  component: ForgotPasswordPage,
});
