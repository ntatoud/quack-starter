import type { ReactNode } from "react";
import { Text as EmailText } from "react-email";

export function Text({ children }: { children: ReactNode }) {
  return <EmailText className="text-foreground my-4 text-sm leading-6">{children}</EmailText>;
}
