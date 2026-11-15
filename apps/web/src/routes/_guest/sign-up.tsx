import { createFileRoute, redirect } from "@tanstack/react-router";

import { SignUpPage } from "#/features/identity/sign-up-page.tsx";

export const Route = createFileRoute("/_guest/sign-up")({
  // Also what leads away once the sign-up sets the Current User.
  beforeLoad: ({ context }) => {
    if (context.currentUser !== null) throw redirect({ to: "/" });
  },
  component: SignUpPage,
});
