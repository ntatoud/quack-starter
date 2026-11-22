import { TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";

/** A bordered box with an icon, for a warning the User must not miss. */
export function Callout({
  tone,
  title,
  children,
}: {
  tone: "warning" | "info";
  title: string;
  children: ReactNode;
}) {
  const classes =
    tone === "warning"
      ? "border-amber-500/50 bg-amber-500/10 text-foreground"
      : "border-border bg-muted/50 text-foreground";
  return (
    <div role="note" className={`flex gap-3 rounded-lg border p-3 text-sm ${classes}`}>
      <TriangleAlertIcon
        aria-hidden
        className={`mt-0.5 size-4 shrink-0 ${tone === "warning" ? "text-amber-600" : "text-muted-foreground"}`}
      />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
