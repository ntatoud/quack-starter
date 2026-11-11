import { createFileRoute, redirect } from "@tanstack/react-router";

import { redirectTarget } from "#/features/identity/redirect-target.ts";
import { SignInPage } from "#/features/identity/sign-in-page.tsx";

export const Route = createFileRoute("/sign-in")({
  // `redirect` is the page to come back to once signed in. Anyone can write it in a link: read it through `redirectTarget` only.
  validateSearch: (search): { redirect?: string } =>
    typeof search["redirect"] === "string" ? { redirect: search["redirect"] } : {},
  // A User who is signed in has nothing to do here. It also runs when the sign-in sets the Current User.
  beforeLoad: ({ context, search }) => {
    if (context.currentUser !== null) throw redirect({ href: redirectTarget(search.redirect) });
  },
  component: SignInPage,
});
