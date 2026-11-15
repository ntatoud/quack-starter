import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@quack/ui/components/empty";

import { ButtonLink } from "#/components/button-link.tsx";

export function NotFound() {
  return (
    <Empty className="min-h-svh">
      <EmptyHeader>
        <EmptyTitle>
          <h1>404</h1>
        </EmptyTitle>
        <EmptyDescription>This page does not exist.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <ButtonLink to="/" variant="outline" size="sm">
          Back home
        </ButtonLink>
      </EmptyContent>
    </Empty>
  );
}
