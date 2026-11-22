import { Button } from "@quack/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@quack/ui/components/empty";

export function LoadFailed({
  title,
  retrying,
  onRetry,
}: {
  title: string;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader role="alert">
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>Check your connection and try again.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" size="sm" disabled={retrying} onClick={onRetry}>
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  );
}
