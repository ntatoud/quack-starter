import { createFileRoute } from "@tanstack/react-router";

import { TodosCard } from "#/features/todos/components/TodosCard.tsx";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="mx-auto max-w-xl p-6 pt-16">
      <TodosCard />
    </main>
  );
}
