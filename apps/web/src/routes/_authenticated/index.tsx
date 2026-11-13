import { createFileRoute } from "@tanstack/react-router";

import { TodosCard } from "#/features/todos/todos-card.tsx";

export const Route = createFileRoute("/_authenticated/")({ component: TodosCard });
