import { PageHeader } from "#/features/layout/page-header.tsx";
import { TodosCard } from "#/features/todos/todos-card.tsx";

export function TodosPage() {
  return (
    <>
      <PageHeader>
        <h1 className="text-sm font-medium">Todos</h1>
      </PageHeader>
      <div className="flex-1 p-6">
        <TodosCard />
      </div>
    </>
  );
}
