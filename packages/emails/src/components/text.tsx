import type { ReactNode } from "react";
import { Text as EmailText } from "react-email";

export function Text({ muted = false, children }: { muted?: boolean; children: ReactNode }) {
  return (
    <EmailText
      className={`${muted ? "text-muted-foreground" : "text-foreground"} my-3 text-sm leading-6`}
    >
      {children}
    </EmailText>
  );
}
