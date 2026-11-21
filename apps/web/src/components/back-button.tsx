import { Button } from "@quack/ui/components/button";
import { type LinkProps, useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";

/** Back to the page before, or to `fallback` when the app was opened on this one. */
export function BackButton({
  fallback = "/app",
  className,
}: {
  fallback?: LinkProps["to"];
  className?: string;
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Back"
      className={className}
      onClick={() => (canGoBack ? router.history.back() : void navigate({ to: fallback }))}
    >
      <ArrowLeftIcon aria-hidden />
    </Button>
  );
}
