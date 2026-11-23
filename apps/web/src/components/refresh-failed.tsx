import { Button } from "@quack/ui/components/button";

export function RefreshFailed({
  message,
  retrying,
  onRetry,
}: {
  message: string;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
      <span>{message}</span>
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0 text-sm"
        disabled={retrying}
        onClick={onRetry}
      >
        Try again
      </Button>
    </p>
  );
}
