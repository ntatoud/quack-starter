import { createFileRoute, redirect } from "@tanstack/react-router";

import { signInLocation } from "#/features/identity/redirect-target.ts";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ context, location }) => {
    if (context.currentUser === null) {
      throw redirect(signInLocation(location.href));
    }
  },
});
