import { createFileRoute } from "@tanstack/react-router";

import { TodosPage } from "#/features/todos/user/todos-page.tsx";

export const Route = createFileRoute("/_authenticated/")({ component: TodosPage });
