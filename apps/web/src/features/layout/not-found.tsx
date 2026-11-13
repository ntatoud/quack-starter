import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@quack/ui/components/empty";

export function NotFound() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>
          <h1>404</h1>
        </EmptyTitle>
        <EmptyDescription>This page does not exist.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
