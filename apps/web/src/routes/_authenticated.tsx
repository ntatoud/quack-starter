import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The pages of a Current User: a route under `routes/_authenticated/` is protected, and its URL does not change,
 * since the layout has no path.
 *
 * A visitor is sent to the sign-in page, which leads back here once they are signed in.
 * It also runs when the Current User becomes `null`, after a sign-out or a Session that expired.
 */
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ context, location }) => {
    if (context.currentUser === null) {
      // `location.href` is the path with its search and hash, not a full URL.
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
  },
});
