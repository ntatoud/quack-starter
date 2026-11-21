import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@quack/ui/components/card";
import type { ReactNode } from "react";

/** The card of a page for visitors: its `title` is the `h1` of the page. */
export function GuestCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle className="text-xl font-semibold tracking-tight">
          <h1>{title}</h1>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
