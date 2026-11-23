import { Button } from "@quack/ui/components/button";

/** The alert above a list whose refresh failed, which keeps what it showed. */
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
