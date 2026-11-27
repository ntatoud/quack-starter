import { createFileRoute } from "@tanstack/react-router";

import { TodayPage } from "#/features/habits/today-page.tsx";
import { pageTitle } from "#/features/layout/page-title.ts";

export const Route = createFileRoute("/_authenticated/app/today")({
  head: () => ({ meta: [{ title: pageTitle("Today") }] }),
  component: TodayPage,
});
