import type { ReactNode } from "react";
import { Button as EmailButton, Section } from "react-email";

export function Button({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section className="my-6">
      <EmailButton
        href={href}
        className="bg-primary text-primary-foreground rounded-md px-5 py-3 text-sm font-medium no-underline"
      >
        {children}
      </EmailButton>
    </Section>
  );
}
