import { createFileRoute, redirect } from "@tanstack/react-router";

import { SignUpPage } from "#/features/identity/sign-up-page.tsx";
import { pageTitle } from "#/features/layout/page-title.ts";

export const Route = createFileRoute("/_guest/sign-up")({
  // Also what leads away once the sign-up sets the Current User.
  beforeLoad: ({ context }) => {
    if (context.currentUser !== null) throw redirect({ to: "/app" });
  },
  head: () => ({ meta: [{ title: pageTitle("Sign up") }] }),
  component: SignUpPage,
});
