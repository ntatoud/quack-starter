import type { ReactNode } from "react";
import { Heading as EmailHeading } from "react-email";

export function Heading({ children }: { children: ReactNode }) {
  return (
    <EmailHeading className="text-foreground mx-0 mt-6 mb-4 text-xl font-semibold">
      {children}
    </EmailHeading>
  );
}
