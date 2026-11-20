import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/settings/")({
  beforeLoad: () => {
    throw redirect({ to: "/app/settings/profile" });
  },
});
