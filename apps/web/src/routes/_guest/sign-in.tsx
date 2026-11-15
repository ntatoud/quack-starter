import { createFileRoute, redirect } from "@tanstack/react-router";
import { Schema } from "effect";

import { redirectTarget } from "#/features/identity/redirect-target.ts";
import { SignInSearch } from "#/features/identity/sign-in-search.ts";
import { SignInPage } from "#/features/identity/sign-in-page.tsx";

export const Route = createFileRoute("/_guest/sign-in")({
  validateSearch: Schema.toStandardSchemaV1(SignInSearch),
  // Also what leads away once the sign-in sets the Current User.
  beforeLoad: ({ context, search }) => {
    if (context.currentUser !== null) throw redirect({ href: redirectTarget(search.redirect) });
  },
  component: SignInPage,
});
