import { createFileRoute, redirect } from "@tanstack/react-router";

import { SignUpPage } from "#/features/identity/sign-up-page.tsx";

export const Route = createFileRoute("/sign-up")({
  // A User who is signed in has nothing to do here. It also runs when the sign-up sets the Current User.
  beforeLoad: ({ context }) => {
    if (context.currentUser !== null) throw redirect({ to: "/" });
  },
  component: SignUpPage,
});
