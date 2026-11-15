import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_admin")({
  beforeLoad: ({ context }) => {
    if (context.currentUser.role !== "admin") throw redirect({ to: "/" });
  },
});
