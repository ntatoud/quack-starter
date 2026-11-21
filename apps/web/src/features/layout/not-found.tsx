import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@quack/ui/components/empty";
import { useLocation } from "@tanstack/react-router";

import { ButtonLink } from "#/components/button-link.tsx";

export function NotFound() {
  const inAdmin = useLocation({ select: ({ pathname }) => /^\/admin(\/|$)/.test(pathname) });

  return (
    <Empty className="min-h-svh">
      <EmptyHeader>
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <EmptyTitle className="text-xl font-semibold">
          <h1>Page not found</h1>
        </EmptyTitle>
        <EmptyDescription>This page does not exist.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <ButtonLink to={inAdmin ? "/admin" : "/app"} variant="outline" size="sm">
          Back home
        </ButtonLink>
      </EmptyContent>
    </Empty>
  );
}
