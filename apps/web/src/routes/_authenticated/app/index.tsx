import { createFileRoute } from "@tanstack/react-router";

import { pageTitle } from "#/features/layout/page-title.ts";
import { TodosPage } from "#/features/todos/todos-page.tsx";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: pageTitle("Todos") }] }),
  component: TodosPage,
});
