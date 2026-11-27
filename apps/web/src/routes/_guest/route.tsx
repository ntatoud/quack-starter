import { createFileRoute, redirect } from "@tanstack/react-router";
import { Schema } from "effect";

import { redirectTarget } from "#/features/identity/redirect-target.ts";
import { SignInSearch } from "#/features/identity/sign-in-search.ts";
import { GuestLayout } from "#/features/layout/guest-layout.tsx";

export const Route = createFileRoute("/_guest")({
  // A signed-in visitor has nothing to do on these pages. Also what leads away once a sign-in or a sign-up sets
  // the Current User: to the `redirect` the sign-in was given, if any.
  beforeLoad: ({ context, location }) => {
    if (context.currentUser === null) return;

    const search = Schema.decodeSync(SignInSearch)(location.search);

    throw redirect({ href: redirectTarget(search.redirect) });
  },
  component: GuestLayout,
});
