import type { ReactNode } from "react";
import { Heading as EmailHeading } from "react-email";

export function Heading({ children }: { children: ReactNode }) {
  return (
    <EmailHeading className="text-foreground m-0 mb-3 text-xl leading-7 font-semibold tracking-tight">
      {children}
    </EmailHeading>
  );
}
